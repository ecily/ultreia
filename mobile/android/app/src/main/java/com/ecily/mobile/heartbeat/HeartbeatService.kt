package com.ecily.mobile.heartbeat

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class HeartbeatService : Service() {

    companion object {
        private const val TAG = "STEPSMATCH-HeartbeatService"
        private const val CHANNEL_ID = "ultreia-bg-location-task"
        private const val NOTIFICATION_ID = 1001
        private const val HEARTBEAT_INTERVAL_MS = 120_000L
        private const val MIN_GAP_MS = 55_000L
        private const val MIN_MOVE_M = 25f
        private const val BOOSTER_MOVE_M = 60f
        private const val BOOSTER_GAP_MS = 45_000L
        private const val STALE_MS = 3 * 60_000L

        private const val ACTION_START = "com.ecily.mobile.heartbeat.START"
        private const val ACTION_STOP = "com.ecily.mobile.heartbeat.STOP"

        private fun hasLocationPermission(context: Context): Boolean {
            val fine = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            val coarse = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            return fine || coarse
        }

        fun start(context: Context) {
            if (!hasLocationPermission(context)) {
                Log.w(TAG, "start(): missing location permission - not starting HeartbeatService")
                return
            }
            val prefs = context.getSharedPreferences(HeartbeatPrefs.PREFS_NAME, Context.MODE_PRIVATE)
            val enabled = prefs.getBoolean(HeartbeatPrefs.KEY_ENABLED, false)
            if (!enabled) {
                Log.i(TAG, "start(): native heartbeat disabled - skip service start")
                return
            }
            val apiBase = prefs.getString(HeartbeatPrefs.KEY_API_BASE, null)
            val token = prefs.getString(HeartbeatPrefs.KEY_TOKEN, null)
            val deviceId = prefs.getString(HeartbeatPrefs.KEY_DEVICE_ID, null)
            if (apiBase.isNullOrBlank() || token.isNullOrBlank() || deviceId.isNullOrBlank()) {
                Log.i(TAG, "start(): missing config/token/deviceId - skip service start")
                return
            }

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
            try {
                context.startService(intent)
            } catch (e: Exception) {
                Log.w(TAG, "stop(): service not running (${e.message})")
            }
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private var isRunning = false
    private var lastHeartbeatAtMs: Long = 0L
    private var lastBoosterAtMs: Long = 0L
    private var lastSentLat: Double? = null
    private var lastSentLng: Double? = null
    private var lastLocation: Location? = null

    private val networkExecutor = Executors.newSingleThreadExecutor()
    private lateinit var fusedClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback

    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            val now = System.currentTimeMillis()
            val loc = lastLocation
            if (loc != null && now - lastHeartbeatAtMs >= STALE_MS) {
                Log.i(TAG, "native stale heartbeat tick")
                sendHeartbeat(loc, reason = "native-stale", force = true)
            }
            handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "onCreate")
        createNotificationChannel()
        fusedClient = LocationServices.getFusedLocationProviderClient(this)
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val loc = result.lastLocation ?: return
                lastLocation = loc
                onLocationUpdate(loc)
            }
        }
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

                    val hasLocPerm = hasLocationPermission(this)
                    if (!hasLocPerm) {
                        Log.w(TAG, "onStartCommand: missing location permission - cannot start foreground service")
                        isRunning = false
                        stopSelf()
                        return START_NOT_STICKY
                    }

                    val enabled = getSharedPreferences(HeartbeatPrefs.PREFS_NAME, Context.MODE_PRIVATE)
                        .getBoolean(HeartbeatPrefs.KEY_ENABLED, false)
                    if (!enabled) {
                        Log.w(TAG, "onStartCommand: native heartbeat disabled (waiting for config)")
                        isRunning = false
                        stopSelf()
                        return START_NOT_STICKY
                    }

                    try {
                        startForeground(NOTIFICATION_ID, buildNotification())
                    } catch (se: SecurityException) {
                        Log.e(TAG, "onStartCommand: startForeground failed: ${se.message}", se)
                        isRunning = false
                        stopSelf()
                        return START_NOT_STICKY
                    } catch (e: Exception) {
                        Log.e(TAG, "onStartCommand: startForeground failed: ${e.message}", e)
                        isRunning = false
                        stopSelf()
                        return START_NOT_STICKY
                    }

                    startLocationUpdates()
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
        stopLocationUpdates()
        try { networkExecutor.shutdown() } catch (_: Exception) {}
        super.onDestroy()
    }

    private fun stopHeartbeat() {
        isRunning = false
        handler.removeCallbacks(heartbeatRunnable)
    }

    private fun startLocationUpdates() {
        try {
            val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 30_000L)
                .setMinUpdateIntervalMillis(15_000L)
                .setMinUpdateDistanceMeters(MIN_MOVE_M)
                .setWaitForAccurateLocation(false)
                .build()

            fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
            Log.i(TAG, "location updates requested")
        } catch (e: Exception) {
            Log.e(TAG, "startLocationUpdates failed: ${e.message}", e)
        }
    }

    private fun stopLocationUpdates() {
        try {
            fusedClient.removeLocationUpdates(locationCallback)
            Log.i(TAG, "location updates stopped")
        } catch (_: Exception) {}
    }

    private fun onLocationUpdate(loc: Location) {
        val now = System.currentTimeMillis()
        if (shouldSendHeartbeat(loc, now)) {
            sendHeartbeat(loc, reason = "native-bg", force = false)
        }

        // Booster: extra heartbeat on larger movement
        if (shouldSendBooster(loc, now)) {
            sendHeartbeat(loc, reason = "native-boost", force = true)
            lastBoosterAtMs = now
        }
    }

    private fun shouldSendHeartbeat(loc: Location, now: Long): Boolean {
        val ageMs = if (lastHeartbeatAtMs > 0) now - lastHeartbeatAtMs else Long.MAX_VALUE
        if (ageMs >= MIN_GAP_MS) return true

        val lat = lastSentLat
        val lng = lastSentLng
        if (lat != null && lng != null) {
            val dist = FloatArray(1)
            Location.distanceBetween(lat, lng, loc.latitude, loc.longitude, dist)
            return dist[0] >= MIN_MOVE_M
        }
        return false
    }

    private fun shouldSendBooster(loc: Location, now: Long): Boolean {
        if (now - lastBoosterAtMs < BOOSTER_GAP_MS) return false
        val lat = lastSentLat
        val lng = lastSentLng
        if (lat == null || lng == null) return true
        val dist = FloatArray(1)
        Location.distanceBetween(lat, lng, loc.latitude, loc.longitude, dist)
        return dist[0] >= BOOSTER_MOVE_M
    }

    private fun loadConfig(): Map<String, String?> {
        val prefs = getSharedPreferences(HeartbeatPrefs.PREFS_NAME, Context.MODE_PRIVATE)
        return mapOf(
            "apiBase" to prefs.getString(HeartbeatPrefs.KEY_API_BASE, null),
            "token" to prefs.getString(HeartbeatPrefs.KEY_TOKEN, null),
            "deviceId" to prefs.getString(HeartbeatPrefs.KEY_DEVICE_ID, null),
            "projectId" to prefs.getString(HeartbeatPrefs.KEY_PROJECT_ID, null),
        )
    }

    private fun sendHeartbeat(loc: Location, reason: String, force: Boolean) {
        val cfg = loadConfig()
        val apiBase = cfg["apiBase"]
        val token = cfg["token"]
        val deviceId = cfg["deviceId"]
        val projectId = cfg["projectId"]

        if (apiBase.isNullOrBlank() || token.isNullOrBlank() || deviceId.isNullOrBlank()) {
            Log.w(TAG, "sendHeartbeat skipped (missing config/token/deviceId)")
            return
        }

        networkExecutor.execute {
            try {
                val url = URL("${apiBase}/location/heartbeat")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.connectTimeout = 15_000
                conn.readTimeout = 15_000
                conn.doOutput = true

                val body = JSONObject()
                body.put("token", token)
                body.put("deviceId", deviceId)
                body.put("projectId", projectId)
                body.put("platform", "android")
                body.put("reason", reason)
                body.put("source", "native")
                body.put("lat", loc.latitude)
                body.put("lng", loc.longitude)
                body.put("accuracy", loc.accuracy)
                if (loc.hasSpeed()) body.put("speed", loc.speed)

                conn.outputStream.use { os ->
                    os.write(body.toString().toByteArray(Charsets.UTF_8))
                }

                val code = conn.responseCode
                if (code in 200..299) {
                    lastHeartbeatAtMs = System.currentTimeMillis()
                    lastSentLat = loc.latitude
                    lastSentLng = loc.longitude
                    Log.i(TAG, "heartbeat sent ok code=$code reason=$reason")
                } else {
                    Log.w(TAG, "heartbeat failed code=$code reason=$reason")
                }
                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "heartbeat error: ${e.message}", e)
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val existing = mgr.getNotificationChannel(CHANNEL_ID)
            if (existing == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Ultreia Service",
                    NotificationManager.IMPORTANCE_MIN
                ).apply {
                    description = "H\u00e4lt Ultreia im Hintergrund aktiv"
                    setShowBadge(false)
                    enableVibration(false)
                }
                mgr.createNotificationChannel(channel)
            }
        }
    }

    private fun buildNotification(): Notification {
        val iconResId = resources.getIdentifier(
            "notification_icon",
            "drawable",
            packageName
        ).takeIf { it != 0 } ?: resources.getIdentifier(
            "ic_launcher",
            "mipmap",
            packageName
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Ultreia l\u00e4uft - Angebote aktiv")
            .setContentText("Sorgt f\u00fcr regelm\u00e4\u00dfige Heartbeats im Hintergrund.")
            .setSmallIcon(iconResId)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
    }
}
