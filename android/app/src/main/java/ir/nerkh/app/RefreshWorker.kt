package ir.nerkh.app

import android.annotation.SuppressLint
import android.content.Context
import android.util.Log
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

// The background round: fetch prices, redraw the widgets, notify new alert firings.
// Android runs it every 15 minutes at most (its minimum), and right away via refreshNow().

private const val CHANNEL = "alerts"
private const val LAST_SEEN = "alerts.lastSeen"
private const val PERIOD_MIN = 15L

class RefreshWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val context = applicationContext
        val prefs = Prefs(context)
        val data = NerkhData(prefs, UrlHttp(), serverUrl(context))
        val board = data.board()
        updateAllWidgets(context, data, board)
        try {
            notifyAlerts(context, data, prefs, board)
        } catch (e: Exception) {
            Log.w("nerkh", "alerts not checked, next round tries again: $e")
        }
        return Result.success()
    }
}

// Redraw now (favourites changed, app opened, widget added) and make sure the 15-minute round is scheduled.
fun refreshNow(context: Context) {
    val work = WorkManager.getInstance(context)
    val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
    work.enqueueUniquePeriodicWork(
        "nerkh-refresh", ExistingPeriodicWorkPolicy.KEEP,
        PeriodicWorkRequest.Builder(RefreshWorker::class.java, PERIOD_MIN, TimeUnit.MINUTES).setConstraints(online).build(),
    )
    // No network constraint here: offline, the widgets still redraw from the saved prices with their real age.
    work.enqueueUniqueWork("nerkh-now", ExistingWorkPolicy.REPLACE, OneTimeWorkRequest.from(RefreshWorker::class.java))
}

@SuppressLint("MissingPermission") // checked by areNotificationsEnabled()
private fun notifyAlerts(context: Context, data: NerkhData, prefs: KeyValue, board: Board?) {
    val seen = prefs.get(LAST_SEEN)?.toLongOrNull()
    if (seen == null) {
        // First run: alerts that fired before the app was installed are old news.
        prefs.put(LAST_SEEN, System.currentTimeMillis().toString())
        return
    }
    val fired = alertsToNotify(data, seen)
    if (fired.isEmpty()) return
    val nm = NotificationManagerCompat.from(context)
    nm.createNotificationChannel(
        NotificationChannelCompat.Builder(CHANNEL, NotificationManagerCompat.IMPORTANCE_HIGH).setName("هشدارهای قیمت").build(),
    )
    for (alert in fired) {
        val item = board?.items?.get(alert.item) ?: continue
        val price = board.quotes[alert.item]?.price ?: alert.target
        val (title, body) = alertText(item, alert, price)
        val n = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_nerkh)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(openApp(context, alert.item))
            .setAutoCancel(true)
            .build()
        if (nm.areNotificationsEnabled()) nm.notify(alert.id.hashCode(), n)
    }
    // Moved on even when notifications are off, so turning them on later doesn't replay old alerts.
    prefs.put(LAST_SEEN, fired.maxOf { it.firedAt ?: 0 }.toString())
}
