package com.example.gameaudiostream.sender

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.util.Patterns
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.example.gameaudiostream.R
import com.example.gameaudiostream.core.StreamConfig
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText

/**
 * Sender screen: enter the receiver's IP, grant the MediaProjection consent
 * dialog, and stream this phone's internal game audio over TCP.
 */
class SenderActivity : AppCompatActivity() {

    private lateinit var ipInput: TextInputEditText
    private lateinit var startStopButton: MaterialButton
    private lateinit var statusView: TextView

    private var pendingReceiverIp: String? = null

    /** Runtime permissions: RECORD_AUDIO (required) + POST_NOTIFICATIONS (best effort). */
    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
            if (grants[Manifest.permission.RECORD_AUDIO] == true) {
                requestProjectionConsent()
            } else {
                render(
                    SenderService.UiState(
                        SenderService.State.ERROR,
                        getString(R.string.sender_error_record_audio_denied)
                    )
                )
            }
        }

    /** System "record screen" consent dialog; its result authorises audio capture. */
    private val projectionLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val data = result.data
            val ip = pendingReceiverIp
            if (result.resultCode == Activity.RESULT_OK && data != null && ip != null) {
                render(
                    SenderService.UiState(
                        SenderService.State.CONNECTING,
                        getString(R.string.sender_status_connecting, ip, StreamConfig.PORT)
                    )
                )
                SenderService.start(this, result.resultCode, data, ip)
            } else {
                render(
                    SenderService.UiState(
                        SenderService.State.ERROR,
                        getString(R.string.sender_error_consent_denied)
                    )
                )
            }
        }

    private val uiListener: (SenderService.UiState) -> Unit = { render(it) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_sender)
        title = getString(R.string.sender_title)

        ipInput = findViewById(R.id.etReceiverIp)
        startStopButton = findViewById(R.id.btnStartStop)
        statusView = findViewById(R.id.tvSenderStatus)

        startStopButton.setOnClickListener { onStartStopClicked() }
        render(SenderService.currentUiState())
    }

    override fun onStart() {
        super.onStart()
        SenderService.setUiListener(uiListener)
    }

    override fun onStop() {
        super.onStop()
        SenderService.setUiListener(null)
    }

    private fun onStartStopClicked() {
        if (SenderService.isRunning) {
            render(
                SenderService.UiState(
                    SenderService.State.IDLE,
                    getString(R.string.sender_status_stopping)
                )
            )
            SenderService.stop(this)
            return
        }

        val ip = ipInput.text?.toString()?.trim().orEmpty()
        when {
            ip.isEmpty() -> render(
                SenderService.UiState(SenderService.State.ERROR, getString(R.string.sender_error_ip_empty))
            )
            !Patterns.IP_ADDRESS.matcher(ip).matches() -> render(
                SenderService.UiState(SenderService.State.ERROR, getString(R.string.sender_error_ip_invalid, ip))
            )
            else -> {
                pendingReceiverIp = ip
                ensurePermissionsThenRequestConsent()
            }
        }
    }

    private fun ensurePermissionsThenRequestConsent() {
        val wanted = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            wanted += Manifest.permission.POST_NOTIFICATIONS
        }
        val missing = wanted.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            requestProjectionConsent()
        } else {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    private fun requestProjectionConsent() {
        val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        try {
            projectionLauncher.launch(manager.createScreenCaptureIntent())
        } catch (e: Exception) {
            render(
                SenderService.UiState(
                    SenderService.State.ERROR,
                    getString(
                        R.string.sender_error_projection_unavailable,
                        e.message ?: e.javaClass.simpleName
                    )
                )
            )
        }
    }

    private fun render(state: SenderService.UiState) {
        statusView.text = state.message
        statusView.setTextColor(ContextCompat.getColor(this, colorFor(state.state)))
        val running = SenderService.isRunning
        startStopButton.text =
            getString(if (running) R.string.sender_btn_stop else R.string.sender_btn_start)
        startStopButton.setIconResource(if (running) R.drawable.ic_stop else R.drawable.ic_play)
        ipInput.isEnabled = !running
    }

    private fun colorFor(state: SenderService.State): Int = when (state) {
        SenderService.State.STREAMING -> R.color.status_streaming
        SenderService.State.CONNECTING -> R.color.status_waiting
        SenderService.State.ERROR -> R.color.status_error
        SenderService.State.IDLE -> R.color.status_idle
    }
}
