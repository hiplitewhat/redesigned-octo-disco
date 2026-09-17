package com.example.gameaudiostream

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.example.gameaudiostream.receiver.ReceiverActivity
import com.example.gameaudiostream.sender.SenderActivity
import com.google.android.material.button.MaterialButton

/**
 * Entry screen: pick whether this phone should SEND its internal game audio
 * or RECEIVE audio from the other phone.
 */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        findViewById<MaterialButton>(R.id.btnSend).setOnClickListener {
            startActivity(Intent(this, SenderActivity::class.java))
        }
        findViewById<MaterialButton>(R.id.btnReceive).setOnClickListener {
            startActivity(Intent(this, ReceiverActivity::class.java))
        }
    }
}
