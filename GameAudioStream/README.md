# Game Audio Stream (Android, Kotlin)

Stream a phone's **internal game audio** to another phone in (near) real time
over Wi-Fi, using only Android SDK APIs and standard Java/Kotlin sockets —
no third-party audio or streaming libraries.

- **Sender** — captures the audio other apps are playing with the
  **AudioPlaybackCapture** API (Android 10 / API 29+) via a MediaProjection
  session, and sends the raw PCM bytes over a TCP socket.
- **Receiver** — accepts a TCP connection and plays the raw PCM stream with an
  **AudioTrack** in `MODE_STREAM`.

```
┌─────────────────── SENDER ───────────────────┐      ┌────────────── RECEIVER ──────────────┐
│ Game app ─▶ Android mixer                    │      │                                      │
│              │ (USAGE_GAME / USAGE_MEDIA)    │      │                                      │
│              ▼                               │      │                                      │
│ AudioPlaybackCapture ─▶ AudioRecord          │ TCP  │ Socket ─▶ AudioTrack (MODE_STREAM)   │
│ (MediaProjection consent, FGS mediaProjection│ ───▶ │ (ServerSocket :8888,                 │
│  PCM 16-bit / 44 100 Hz / stereo, :8888)     │      │  FGS mediaPlayback) ─▶ speaker       │
└──────────────────────────────────────────────┘      └──────────────────────────────────────┘
```

## Requirements

- Android 10 (API 29) or newer on both phones (`minSdk 29`, `targetSdk 34`).
- Both phones on the **same Wi-Fi network** (hotspot works too).
- Android Studio Hedgehog (or newer) with JDK 17, **or** a local Gradle 8.4 install.

## Project structure

```
GameAudioStream/
├── settings.gradle / build.gradle / gradle.properties
├── gradle/wrapper/gradle-wrapper.properties          (Gradle 8.4)
└── app/
    ├── build.gradle                                  (AGP 8.2.2, Kotlin 1.9.22, no extra libs)
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/com/example/gameaudiostream/
        │   ├── MainActivity.kt                       Send / Receive choice screen
        │   ├── core/StreamConfig.kt                  44 100 Hz · 16-bit · stereo · port 8888
        │   ├── core/NetworkUtils.kt                  "what is my LAN IP" helper
        │   ├── sender/SenderActivity.kt              IP input, permissions, consent flow
        │   ├── sender/SenderService.kt               capture + TCP pump (foreground service)
        │   ├── receiver/ReceiverActivity.kt          shows own IP, start/stop
        │   └── receiver/ReceiverService.kt           TCP listener + AudioTrack playback
        └── res/                                      layouts, Material 3 dark theme, icons
```

## Build & install

### Option A — Android Studio (recommended)

1. `File ▸ Open…` and select the `GameAudioStream/` folder.
2. If Studio reports that the Gradle wrapper JAR is missing (the binary
   `gradle-wrapper.jar` is intentionally not checked in), generate it once:
   open the built-in terminal and run
   `gradle wrapper --gradle-version 8.4` (any local Gradle ≥ 8.2 works),
   then re-sync. On a fresh machine you can also create the project wrapper
   from Android Studio's *Gradle wrapper* repair prompt.
3. Run the `app` configuration on each phone (`Run ▸ Run 'app'`).

### Option B — command line

```bash
cd GameAudioStream
gradle wrapper --gradle-version 8.4   # once, if gradlew is not present yet
./gradlew :app:assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Option C — GitHub Actions (no local tooling needed)

`.github/workflows/android.yml` builds a debug APK on every push/PR that
touches `GameAudioStream/**`. Download the `GameAudioStream-debug-apk`
artifact from the run page and `adb install` it — no local Android SDK
required.

## How to use

1. Install the app on **both** phones and connect both to the same Wi-Fi.
2. **Receiver phone** — tap *Receive Audio*, then *Start Receiving*.
   The screen shows its address (e.g. `192.168.1.42`) and turns to
   “Listening on port 8888”.
3. **Sender phone** — tap *Send Audio*, type the receiver's address,
   tap *Start Sending*, then:
   - allow the *Record audio* permission (first time only),
   - allow notifications (Android 13+, optional but recommended),
   - allow the system **“Record/cast screen”** dialog — this is the
     MediaProjection consent that authorises internal audio capture.
4. Start your game on the sender. Its sound plays on the receiver.
5. Stop either with the on-screen button or the *Stop* action in the
   persistent notification.

While streaming, both sides keep running as **foreground services**, so the
stream survives screen-off and app switching.

## What happens under the hood

| Piece | Detail |
|---|---|
| Capture consent | `MediaProjectionManager.createScreenCaptureIntent()` → user dialog |
| Capture API | `AudioPlaybackCaptureConfiguration` matching `USAGE_GAME` + `USAGE_MEDIA`, fed into an `AudioRecord` |
| Format | PCM 16-bit, 44 100 Hz, stereo (see `core/StreamConfig.kt`) |
| Transport | Raw PCM bytes over a TCP socket, **port 8888**, no header/framing |
| Playback | `AudioTrack`, `MODE_STREAM`, same format |
| Foreground services | Sender: `mediaProjection` type. Receiver: `mediaPlayback` type. On Android 14 the sender calls `startForeground()` **before** `getMediaProjection()`, as required |

There is deliberately no buffering/JITTER buffer beyond the AudioTrack buffer:
latency is usually well under a second on a healthy Wi-Fi network. TCP handles
loss retransmission; a congested network will add latency rather than drop audio.

## Permissions explained

| Permission | Why |
|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | TCP streaming |
| `RECORD_AUDIO` | Requested at runtime before capture (MediaProjection audio path) |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MEDIA_PROJECTION` | Sender foreground service |
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Receiver foreground service (required on targetSdk 34) |
| `POST_NOTIFICATIONS` | Runtime-requested on Android 13+ so the persistent service notifications are visible |

## Troubleshooting

- **“Connection refused / timed out”** — the receiver isn't started, the IP is
  wrong (IPs change when phones re-join Wi-Fi — re-check the receiver screen),
  or the phones are on different networks.
- **Connected but silent** — make sure something is actually playing on the
  sender with volume up. Apps that opt out of playback capture (DRM/streaming
  protection, some browsers) deliberately produce silence.
- **Sender on mobile data** — capture still works, but the phones must still be
  reachable on the same LAN for TCP to connect.
- **Guest/corporate Wi-Fi with client isolation** — devices cannot see each
  other; use a personal hotspot instead.
- **Choppy audio** — move closer to the router; only one sender is accepted at
  a time by the receiver.

## Limitations

- Audio only (no video) — by design.
- One sender → one receiver; the receiver queues additional senders after the
  current one disconnects.
- Protected content (DRM) is muted by the platform and cannot be captured.
