package ir.nerkh.app

import android.Manifest
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

// What public/native.js calls as window.Capacitor.Plugins.Nerkh.
@CapacitorPlugin(
    name = "Nerkh",
    permissions = [Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications")],
)
class NerkhPlugin : Plugin() {

    @PluginMethod
    fun refreshWidgets(call: PluginCall) {
        refreshNow(context)
        call.resolve()
    }

    // Android 13+ asks the user; older versions only have the on/off switch in settings.
    @PluginMethod
    fun requestNotifications(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.GRANTED) {
            return resolveGranted(call)
        }
        requestPermissionForAlias("notifications", call, "notificationsAnswered")
    }

    @PermissionCallback
    private fun notificationsAnswered(call: PluginCall) = resolveGranted(call)

    private fun resolveGranted(call: PluginCall) =
        call.resolve(JSObject().put("granted", NotificationManagerCompat.from(context).areNotificationsEnabled()))
}
