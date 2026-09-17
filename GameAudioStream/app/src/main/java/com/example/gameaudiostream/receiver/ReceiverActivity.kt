package com.example.gameaudiostream.receiver

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.example.gameaudiostream.R
import com.example.gameaudiostream.core.NetworkUtils
import com.google.android.material.button.MaterialButton

/**
 * Receiver screen: shows this phone's LAN address (the one the sender must
 * enter), and starts/stops the TCP listener + AudioTrack playback.
 */
class ReceiverActivity : AppCompatActivity() {

    private lateinit var ipView: TextView
    private lateinit var startStopButton: MaterialButton
    private lateinit var statusView: TextView

    /** Notification permission (API 33+) is best-effort: the service works either way. */
    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            startReceiver() // proceed regardless of the user's choice
        }

    private val uiListener: (ReceiverService.UiState) -> Unit = { render(it) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_receiver)
        title = getString(R.string.receiver_title)

        ipView = findViewById(R.id.tvReceiverIp)
        startStopButton = findViewById(R.id.btnStartStop)
        statusView = findViewById(R.id.tvReceiverStatus)

        startStopButton.setOnClickListener { onStartStopClicked() }
        render(ReceiverService.currentUiState())
    }

    override fun onStart() {
        super.onStart()
        ReceiverService.setUiListener(uiListener)
    }

    override fun onStop() {
        super.onStop()
        ReceiverService.setUiListener(null)
    }

    override fun onResume() {
        super.onResume()
        refreshOwnAddress()
    }

    private fun refreshOwnAddress() {
        ipView.text = NetworkUtils.localIpv4Address()
            ?: getString(R.string.receiver_ip_unavailable)
    }

    private fun onStartStopClicked() {
        if (ReceiverService.isRunning) {
            render(
                ReceiverService.UiState(
                    ReceiverService.State.IDLE,
                    getString(R.string.receiver_status_stopping)
                )
            )
            ReceiverService.stop(this)
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                startReceiver()
            }
        }
    }

    private fun startReceiver() {
        render(
            ReceiverService.UiState(
                ReceiverService.State.WAITING,
                getString(R.string.receiver_status_starting)
            )
        )
        ReceiverService.start(this)
    }

    private fun render(state: ReceiverService.UiState) {
        statusView.text = state.message
        statusView.setTextColor(ContextCompat.getColor(this, colorFor(state.state)))
        val running = ReceiverService.isRunning
        startStopButton.text =
            getString(if (running) R.string.receiver_btn_stop else R.string.receiver_btn_start)
        startStopButton.setIconResource(if (running) R.drawable.ic_stop else R.drawable.ic_play)
    }

    private fun colorFor(state: ReceiverService.State): Int = when (state) {
        ReceiverService.State.STREAMING -> R.color.status_streaming
        ReceiverService.State.WAITING -> R.color.status_waiting
        ReceiverService.State.ERROR -> R.color.status_error
        ReceiverService.State.IDLE -> R.color.status_idle
    }
}
