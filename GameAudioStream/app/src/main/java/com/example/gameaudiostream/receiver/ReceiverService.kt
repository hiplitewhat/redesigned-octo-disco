package com.example.gameaudiostream.receiver

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
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.example.gameaudiostream.MainActivity
import com.example.gameaudiostream.R
import com.example.gameaudiostream.core.StreamConfig
import java.io.BufferedInputStream
import java.io.IOException
import java.net.BindException
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import kotlin.concurrent.thread

/**
 * Foreground service that listens on TCP port 8888, accepts one sender at a
 * time and plays the incoming raw PCM stream (16-bit / 44.1 kHz / stereo)
 * with an AudioTrack in MODE_STREAM.
 *
 * When a sender disconnects, the service goes back to accepting new
 * connections until the user stops it.
 */
class ReceiverService : Service() {

    enum class State { IDLE, WAITING, STREAMING, ERROR }

    data class UiState(val state: State, val message: String)

    companion object {
        private const val TAG = "ReceiverService"

        const val ACTION_START = "com.example.gameaudiostream.action.RECEIVER_START"
        const val ACTION_STOP = "com.example.gameaudiostream.action.RECEIVER_STOP"

        private const val CHANNEL_ID = "receiver_stream"
        private const val NOTIFICATION_ID = 2001

        /** Observable service status, shared with ReceiverActivity. */
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

        fun start(context: Context) {
            val intent = Intent(context, ReceiverService::class.java).apply { action = ACTION_START }
            ContextCompat.startForegroundService(context, intent)
        }

        /** Ask the service to stop gracefully. */
        fun stop(context: Context) {
            val intent = Intent(context, ReceiverService::class.java).apply { action = ACTION_STOP }
            // The service is already in the foreground, so a plain startService is allowed
            // and avoids the startForegroundService()/startForeground() contract entirely.
            context.startService(intent)
        }
    }

    private var serverSocket: ServerSocket? = null
    private var clientSocket: Socket? = null
    private var audioTrack: AudioTrack? = null
    private var acceptThread: Thread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val notificationManager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notif_channel_receiver),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = getString(R.string.notif_channel_receiver_desc)
        }
        notificationManager.createNotificationChannel(channel)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startListening()
            ACTION_STOP -> {
                if (isRunning) {
                    publishState(
                        State.IDLE,
                        getString(R.string.receiver_status_stopped),
                        toastRes = R.string.toast_receiver_stopped
                    )
                }
                shutdown()
            }
            else -> shutdown() // Unknown action or stale restart: nothing to do.
        }
        return START_NOT_STICKY
    }

    private fun startListening() {
        if (isRunning || acceptThread?.isAlive == true) {
            Log.w(TAG, "startListening ignored: receiver is already running")
            return
        }

        // Promote to a mediaPlayback foreground service first (required on targetSdk 34).
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(getString(R.string.receiver_notification_starting)),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        )

        isRunning = true
        publishState(
            State.WAITING,
            getString(R.string.receiver_status_waiting, StreamConfig.PORT),
            toastRes = R.string.toast_receiver_started
        )
        acceptThread = thread(name = "receiver-accept") { acceptLoop() }
    }

    private fun acceptLoop() {
        try {
            val server = ServerSocket()
            server.reuseAddress = true
            server.bind(InetSocketAddress(StreamConfig.PORT))
            serverSocket = server

            while (isRunning) {
                val client = try {
                    server.accept()
                } catch (e: IOException) {
                    break // shutdown() closed the server socket.
                }
                if (isRunning) serve(client) else break
            }
        } catch (e: Exception) {
            Log.e(TAG, "Receiver failed", e)
            if (isRunning) {
                publishState(
                    State.ERROR,
                    getString(R.string.receiver_error_stream, describe(e)),
                    toastRes = R.string.toast_stream_error
                )
            }
        } finally {
            // Only the ACTIVE worker may tear the service down. Otherwise a slow
            // dying thread from a previous session could kill a fresh listener.
            if (Thread.currentThread() === acceptThread) {
                shutdown()
            }
        }
    }

    /** Play one sender's stream to completion, then return to the accept loop. */
    private fun serve(client: Socket) {
        var track: AudioTrack? = null
        try {
            clientSocket = client
            client.tcpNoDelay = true
            val senderAddress = client.inetAddress?.hostAddress
                ?: getString(R.string.receiver_unknown_sender)

            val created = createAudioTrack()
            track = created
            audioTrack = created
            if (created.state != AudioTrack.STATE_INITIALIZED) {
                throw IllegalStateException("AudioTrack failed to initialise (state=${created.state})")
            }
            created.play()

            publishState(
                State.STREAMING,
                getString(R.string.receiver_status_streaming, senderAddress),
                toastRes = R.string.toast_streaming_started
            )

            // Raw PCM pump: TCP -> AudioTrack. No framing: raw PCM bytes only.
            val input = BufferedInputStream(client.getInputStream(), StreamConfig.CHUNK_SIZE_BYTES * 2)
            val chunk = ByteArray(StreamConfig.CHUNK_SIZE_BYTES)
            while (isRunning) {
                val read = input.read(chunk)
                if (read < 0) break // sender closed the connection cleanly
                if (created.write(chunk, 0, read) < 0) {
                    throw IOException("AudioTrack.write() failed")
                }
            }

            if (isRunning) {
                publishState(
                    State.WAITING,
                    getString(R.string.receiver_status_waiting_again),
                    toastRes = R.string.toast_sender_disconnected
                )
            }
        } catch (e: IOException) {
            // Abrupt disconnects (TCP reset, dropped Wi-Fi) surface as IOExceptions
            // mid-stream. Treat them as a normal sender hang-up, not a fatal error.
            Log.i(TAG, "Sender disconnected: ${e.message}")
            if (isRunning) {
                publishState(
                    State.WAITING,
                    getString(R.string.receiver_status_waiting_again),
                    toastRes = R.string.toast_sender_disconnected
                )
            }
        } finally {
            clientSocket = null
            try {
                client.close()
            } catch (_: Exception) {
            }
            // Release only if this track is still ours (shutdown() may have taken it).
            val ours = track
            if (ours != null && audioTrack === ours) {
                audioTrack = null
                try {
                    ours.pause()
                } catch (_: Exception) {
                }
                try {
                    ours.flush()
                } catch (_: Exception) {
                }
                try {
                    ours.release()
                } catch (_: Exception) {
                }
            }
        }
    }

    private fun createAudioTrack(): AudioTrack {
        val minBufferSize = AudioTrack.getMinBufferSize(
            StreamConfig.SAMPLE_RATE, StreamConfig.CHANNELS_OUT, StreamConfig.ENCODING
        )
        if (minBufferSize <= 0) {
            throw IllegalStateException("AudioTrack.getMinBufferSize returned $minBufferSize")
        }
        return AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(StreamConfig.ENCODING)        // PCM 16-bit
                    .setSampleRate(StreamConfig.SAMPLE_RATE)   // 44100 Hz
                    .setChannelMask(StreamConfig.CHANNELS_OUT) // stereo
                    .build()
            )
            .setTransferMode(AudioTrack.MODE_STREAM)
            .setBufferSizeInBytes(minBufferSize * 2)
            .setSessionId(AudioManager.AUDIO_SESSION_ID_GENERATE)
            .build()
    }

    /** Idempotent teardown: safe to call from any thread, any number of times. */
    private fun shutdown() {
        isRunning = false
        acceptThread = null
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        try {
            serverSocket?.close() // unblocks accept()
        } catch (_: Exception) {
        }
        serverSocket = null
        try {
            clientSocket?.close() // unblocks read()
        } catch (_: Exception) {
        }
        clientSocket = null
        val track = audioTrack
        audioTrack = null
        if (track != null) {
            try {
                track.pause()
            } catch (_: Exception) {
            }
            try {
                track.flush()
            } catch (_: Exception) {
            }
            try {
                track.release()
            } catch (_: Exception) {
            }
        }
        stopSelf()
    }

    private fun describe(e: Exception): String = when (e) {
        is BindException -> getString(R.string.receiver_error_port, StreamConfig.PORT, e.message ?: "")
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
            Intent(this, ReceiverService::class.java).setAction(ACTION_STOP),
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
            .setContentTitle(getString(R.string.receiver_notification_title))
            .setContentText(text)
            .setContentIntent(contentIntent)
            .addAction(0, getString(R.string.notification_action_stop), stopIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }
}
