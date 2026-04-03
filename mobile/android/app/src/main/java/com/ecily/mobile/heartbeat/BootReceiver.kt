package com.ecily.mobile.heartbeat

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try {
            val prefs = context.getSharedPreferences(HeartbeatPrefs.PREFS_NAME, Context.MODE_PRIVATE)
            val enabled = prefs.getBoolean(HeartbeatPrefs.KEY_ENABLED, false)
            if (!enabled) return

            if (Intent.ACTION_BOOT_COMPLETED == intent.action ||
                Intent.ACTION_LOCKED_BOOT_COMPLETED == intent.action) {
                Log.i("STEPSMATCH-Boot", "boot completed -> start HeartbeatService")
                HeartbeatService.start(context)
            }
        } catch (_: Exception) {}
    }
}
