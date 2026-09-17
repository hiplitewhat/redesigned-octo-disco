package com.example.gameaudiostream.sender

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import com.example.gameaudiostream.MainActivity
import com.example.gameaudiostream.R
import com.example.gameaudiostream.core.StreamConfig
import java.io.BufferedOutputStream
import java.io.IOException
import java.net.ConnectException
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import kotlin.concurrent.thread

/**
 * Foreground service that captures the device's INTERNAL audio (games + media)
 * with the AudioPlaybackCapture API and streams the raw PCM frames over a TCP
 * socket to a receiver running [com.example.gameaudiostream.receiver.ReceiverService].
 *
 * Consent + start order (mandatory on Android 14 / targetSdk 34):
 *   1. Activity shows MediaProjectionManager.createScreenCaptureIntent()
 *   2. Activity calls SenderService.start() (startForegroundService)
 *   3. Service calls startForeground(FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
 *   4. Service calls getMediaProjection(resultCode, resultData)
 *   5. Service builds AudioPlaybackCaptureConfiguration and starts pumping PCM.
 */
class SenderService : Service() {

    enum class State { IDLE, CONNECTING, STREAMING, ERROR }

    data class UiState(val state: State, val message: String)

    companion object {
        private const val TAG = "SenderService"

        const val ACTION_START = "com.example.gameaudiostream.action.SENDER_START"
        const val ACTION_STOP = "com.example.gameaudiostream.action.SENDER_STOP"

        private const val EXTRA_RESULT_CODE = "resultCode"
        private const val EXTRA_RESULT_DATA = "resultData"
        private const val EXTRA_RECEIVER_IP = "receiverIp"

        private const val CHANNEL_ID = "sender_stream"
        private const val NOTIFICATION_ID = 1001

        /** Observable service status, shared with SenderActivity. */
        @Volatile
        private var lastState = UiState(State.IDLE, "")

        @Volatile
        var isRunning = false
            private set

        private var listener: ((UiState) -> Unit)? = null

        private val mainHandler = Handler(Looper.getMainLooper())

        /** UI subscribes here; the latest state is replayed immediately on registration. */
        fun setUiListener(newListener: ((UiState) -> Unit)?) {
            listener = newListener
            newListener?.let { l -> mainHandler.post { l(lastState) } }
        }

        fun currentUiState(): UiState = lastState

        /** Launch the service with the user-granted MediaProjection consent. */
        fun start(context: Context, resultCode: Int, resultData: Intent, receiverIp: String) {
            val intent = Intent(context, SenderService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_RESULT_CODE, resultCode)
                putExtra(EXTRA_RESULT_DATA, resultData)
                putExtra(EXTRA_RECEIVER_IP, receiverIp)
            }
            ContextCompat.startForegroundService(context, intent)
        }

        /** Ask the service to stop gracefully. */
        fun stop(context: Context) {
            val intent = Intent(context, SenderService::class.java).apply { action = ACTION_STOP }
            // The service is already in the foreground, so a plain startService is allowed
            // and avoids the startForegroundService()/startForeground() contract entirely.
            context.startService(intent)
        }
    }

    private var mediaProjection: MediaProjection? = null
    private var socket: Socket? = null
    private var audioRecord: AudioRecord? = null
    private var workerThread: Thread? = null

    private val projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() {
            // Fired when the user stops the capture from the system UI, or when
            // projection.stop() is called by shutdown() (no-op then: isRunning is false).
            if (isRunning) {
                publishState(
                    State.IDLE,
                    getString(R.string.sender_status_stopped_by_system),
                    toastRes = R.string.toast_streaming_stopped
                )
            }
            shutdown()
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val notificationManager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notif_channel_sender),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = getString(R.string.notif_channel_sender_desc)
        }
        notificationManager.createNotificationChannel(channel)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startCapture(intent)
            ACTION_STOP -> {
                if (isRunning) {
                    publishState(
                        State.IDLE,
                        getString(R.string.sender_status_stopped),
                        toastRes = R.string.toast_streaming_stopped
                    )
                }
                shutdown()
            }
            else -> shutdown() // Unknown action or stale restart: nothing to do.
        }
        return START_NOT_STICKY
    }

    private fun startCapture(intent: Intent) {
        if (isRunning || workerThread?.isAlive == true) {
            Log.w(TAG, "startCapture ignored: sender is already running")
            return
        }

        // Android 14+ contract: promote to a mediaProjection foreground service
        // BEFORE calling getMediaProjection(), otherwise SecurityException. Doing
        // it first also satisfies the startForegroundService() contract even if
        // the extras below turn out to be unusable.
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(getString(R.string.sender_notification_starting)),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
        )

        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
        val resultData = IntentCompat.getParcelableExtra(intent, EXTRA_RESULT_DATA, Intent::class.java)
        val receiverIp = intent.getStringExtra(EXTRA_RECEIVER_IP)?.trim().orEmpty()

        if (resultData == null || receiverIp.isEmpty()) {
            publishState(State.ERROR, getString(R.string.sender_error_missing_arguments))
            shutdown()
            return
        }

        val projectionManager =
            getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val projection: MediaProjection = try {
            projectionManager.getMediaProjection(resultCode, resultData)
        } catch (e: Exception) {
            Log.e(TAG, "getMediaProjection failed", e)
            publishState(
                State.ERROR,
                getString(R.string.sender_error_projection, e.message ?: e.javaClass.simpleName)
            )
            shutdown()
            return
        }
        mediaProjection = projection
        projection.registerCallback(projectionCallback, mainHandler)

        isRunning = true
        workerThread = thread(name = "sender-pcm") {
            streamPcmTo(receiverIp, projection)
        }
    }

    /**
     * Worker thread body: connect TCP, build the capture pipeline, then pump
     * raw PCM frames from AudioRecord into the socket until stopped.
     */
    private fun streamPcmTo(receiverIp: String, projection: MediaProjection) {
        try {
            // 1. TCP connection first, so an unreachable receiver fails fast
            //    with a clear message instead of silently streaming nowhere.
            publishState(
                State.CONNECTING,
                getString(R.string.sender_status_connecting, receiverIp, StreamConfig.PORT)
            )
            val sock = Socket()
            socket = sock
            sock.tcpNoDelay = true
            sock.connect(InetSocketAddress(receiverIp, StreamConfig.PORT), StreamConfig.CONNECT_TIMEOUT_MS)
            val output = BufferedOutputStream(sock.getOutputStream(), StreamConfig.CHUNK_SIZE_BYTES * 2)

            // 2. Internal-audio capture pipeline.
            val minBufferSize = AudioRecord.getMinBufferSize(
                StreamConfig.SAMPLE_RATE, StreamConfig.CHANNELS_IN, StreamConfig.ENCODING
            )
            if (minBufferSize <= 0) {
                throw IllegalStateException("AudioRecord.getMinBufferSize returned $minBufferSize")
            }
            val captureConfig = AudioPlaybackCaptureConfiguration.Builder(projection)
                .addMatchingUsage(AudioAttributes.USAGE_GAME)  // game audio
                .addMatchingUsage(AudioAttributes.USAGE_MEDIA) // music/video as a bonus
                .build()
            val pcmFormat = AudioFormat.Builder()
                .setEncoding(StreamConfig.ENCODING)           // PCM 16-bit
                .setSampleRate(StreamConfig.SAMPLE_RATE)      // 44100 Hz
                .setChannelMask(StreamConfig.CHANNELS_IN)     // stereo
                .build()
            val record = AudioRecord.Builder()
                .setAudioFormat(pcmFormat)
                .setBufferSizeInBytes(minBufferSize * 4)
                .setAudioPlaybackCaptureConfig(captureConfig)
                .build()
            audioRecord = record
            if (record.state != AudioRecord.STATE_INITIALIZED) {
                throw IllegalStateException("AudioRecord failed to initialise (state=${record.state})")
            }
            record.startRecording()

            // 3. PCM pump: AudioRecord -> TCP. No framing: raw PCM bytes only.
            val chunk = ByteArray(StreamConfig.CHUNK_SIZE_BYTES)
            publishState(
                State.STREAMING,
                getString(R.string.sender_status_streaming, receiverIp),
                toastRes = R.string.toast_streaming_started
            )
            while (isRunning && !sock.isClosed && sock.isConnected) {
                val read = record.read(chunk, 0, chunk.size)
                if (read == 0) continue
                if (read < 0) throw IOException("AudioRecord.read() failed with code $read")
                output.write(chunk, 0, read)
                output.flush() // push each chunk immediately to keep latency low
            }
            // Loop can also end because the receiver closed the socket on us.
            if (isRunning) {
                publishState(
                    State.IDLE,
                    getString(R.string.sender_status_stopped),
                    toastRes = R.string.toast_streaming_stopped
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Streaming failed", e)
            if (isRunning) {
                publishState(
                    State.ERROR,
                    getString(R.string.sender_error_stream, describe(e)),
                    toastRes = R.string.toast_stream_error
                )
            }
        } finally {
            // Only the ACTIVE worker may tear the service down. Otherwise a slow
            // dying thread from a previous session could kill a fresh stream.
            if (Thread.currentThread() === workerThread) {
                shutdown()
            }
        }
    }

    /** Idempotent teardown: safe to call from any thread, any number of times. */
    private fun shutdown() {
        isRunning = false
        workerThread = null
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        try {
            socket?.close() // unblocks a connect() or read() in progress
        } catch (_: Exception) {
        }
        socket = null
        try {
            audioRecord?.release() // release() also stops the recording
        } catch (_: Exception) {
        }
        audioRecord = null
        val projection = mediaProjection
        mediaProjection = null
        if (projection != null) {
            try {
                projection.unregisterCallback(projectionCallback)
            } catch (_: Exception) {
            }
            try {
                projection.stop()
            } catch (_: Exception) {
            }
        }
        stopSelf()
    }

    private fun describe(e: Exception): String = when (e) {
        is UnknownHostException -> getString(R.string.sender_error_unknown_host, e.message ?: "")
        is ConnectException -> getString(R.string.sender_error_refused, e.message ?: "")
        is SocketTimeoutException -> getString(R.string.sender_error_timeout)
        else -> e.message ?: e.javaClass.simpleName
    }

    /** Update the shared UI state, the notification and (optionally) show a Toast. */
    private fun publishState(state: State, message: String, toastRes: Int? = null) {
        lastState = UiState(state, message)
        mainHandler.post {
            listener?.invoke(lastState)
            toastRes?.let { res ->
                Toast.makeText(applicationContext, res, Toast.LENGTH_SHORT).show()
            }
            if (isRunning) {
                getSystemService(NotificationManager::class.java)
                    .notify(NOTIFICATION_ID, buildNotification(message))
            }
        }
    }

    private fun buildNotification(text: String): Notification {
        val stopIntent = PendingIntent.getService(
            this,
            0,
            Intent(this, SenderService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_audio)
            .setContentTitle(getString(R.string.sender_notification_title))
            .setContentText(text)
            .setContentIntent(contentIntent)
            .addAction(0, getString(R.string.notification_action_stop), stopIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }
}
