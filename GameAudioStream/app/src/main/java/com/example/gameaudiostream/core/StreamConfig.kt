package com.example.gameaudiostream.core

import android.media.AudioFormat

/**
 * Hard-coded stream parameters shared by the sender and the receiver.
 *
 * The TCP transport carries RAW PCM frames with no header or handshake, so
 * both sides MUST agree on these values. If you change anything here, install
 * the same build on both phones.
 */
object StreamConfig {

    /** TCP port used by the receiver (ServerSocket) and the sender (Socket). */
    const val PORT = 8888

    /** Sender-side TCP connect timeout in milliseconds. */
    const val CONNECT_TIMEOUT_MS = 5_000

    /** PCM format: 16-bit, 44.1 kHz, stereo. */
    const val SAMPLE_RATE = 44_100
    const val ENCODING = AudioFormat.ENCODING_PCM_16BIT

    /** Channel masks: AudioRecord wants "IN", AudioTrack wants "OUT". */
    const val CHANNELS_IN = AudioFormat.CHANNEL_IN_STEREO
    const val CHANNELS_OUT = AudioFormat.CHANNEL_OUT_STEREO

    /** Bytes per PCM frame: 2 channels x 2 bytes (16-bit). */
    const val BYTES_PER_FRAME = 4

    /** Streaming chunk size (~185 ms of audio per read/write). */
    const val CHUNK_SIZE_BYTES = 16_384
}
