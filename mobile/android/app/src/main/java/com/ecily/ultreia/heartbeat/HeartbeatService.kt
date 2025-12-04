package com.ecily.ultreia.heartbeat

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat

class HeartbeatService : Service() {

    companion object {
        private const val TAG = "ULTREIA-HeartbeatService"
        private const val CHANNEL_ID = "ultreia-fg" // konsistent mit JS
        private const val NOTIFICATION_ID = 1001
        private const val HEARTBEAT_INTERVAL_MS = 60_000L

        private const val ACTION_START = "com.ecily.ultreia.heartbeat.START"
        private const val ACTION_STOP = "com.ecily.ultreia.heartbeat.STOP"

        fun start(context: Context) {
            val intent = Intent(context, HeartbeatService::class.java).apply {
                action = ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, HeartbeatService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private var isRunning = false

    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            Log.i(TAG, "native heartbeat tick (no HTTP yet)")
            // TODO: später HTTP-Call + Location einbauen
            handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "onCreate")
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        Log.i(TAG, "onStartCommand action=$action")

        when (action) {
            ACTION_STOP -> {
                stopHeartbeat()
                stopForeground(true)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                if (!isRunning) {
                    isRunning = true
                    startForeground(NOTIFICATION_ID, buildNotification())
                    handler.post(heartbeatRunnable)
                    Log.i(TAG, "Heartbeat loop started")
                }
            }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        Log.i(TAG, "onDestroy")
        stopHeartbeat()
        super.onDestroy()
    }

    private fun stopHeartbeat() {
        isRunning = false
        handler.removeCallbacks(heartbeatRunnable)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val existing = mgr.getNotificationChannel(CHANNEL_ID)
            if (existing == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "ULTREIA Service",
                    NotificationManager.IMPORTANCE_MIN
                ).apply {
                    description = "Hält Ultreia im Hintergrund aktiv"
                    setShowBadge(false)
                    enableVibration(false)
                }
                mgr.createNotificationChannel(channel)
            }
        }
    }

    private fun buildNotification(): Notification {
        val iconResId = resources.getIdentifier(
            "ic_notification",
            "mipmap",
            packageName
        ).takeIf { it != 0 } ?: resources.getIdentifier(
            "ic_launcher",
            "mipmap",
            packageName
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ULTREIA läuft – Pilgerhilfe aktiv")
            .setContentText("Sorgt für regelmäßige Herzschläge im Hintergrund.")
            .setSmallIcon(iconResId)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
    }
}
