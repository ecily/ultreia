package com.ecily.mobile.heartbeat

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NativeHeartbeatConfigModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "NativeHeartbeatConfig"

    private val prefs by lazy {
        reactApplicationContext.getSharedPreferences(HeartbeatPrefs.PREFS_NAME, Context.MODE_PRIVATE)
    }

    @ReactMethod
    fun syncConfig(apiBase: String?, token: String?, deviceId: String?, projectId: String?, enabled: Boolean) {
        prefs.edit().apply {
            if (apiBase != null) putString(HeartbeatPrefs.KEY_API_BASE, apiBase)
            if (token != null) putString(HeartbeatPrefs.KEY_TOKEN, token)
            if (deviceId != null) putString(HeartbeatPrefs.KEY_DEVICE_ID, deviceId)
            if (projectId != null) putString(HeartbeatPrefs.KEY_PROJECT_ID, projectId)
            putBoolean(HeartbeatPrefs.KEY_ENABLED, enabled)
        }.apply()

        // Keep native service strictly in sync with JS toggle state.
        try {
            if (enabled) {
                HeartbeatService.start(reactApplicationContext)
            } else {
                HeartbeatService.stop(reactApplicationContext)
            }
        } catch (_: Exception) {}
    }
}
