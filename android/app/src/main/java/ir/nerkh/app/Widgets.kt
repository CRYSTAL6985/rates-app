package ir.nerkh.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews

// The two home-screen widgets. Android draws them from RemoteViews: a description of the layout
// plus the values to put in it, sent to the launcher. Fetching happens in RefreshWorker.

private const val MAX_ROWS = 4
private const val HEAD_DP = 40
private const val ROW_DP = 46

// Prices that have a 3D render (public/img), like the app's background.
private val ART = mapOf(
    "g18" to R.drawable.art_gold, "btc" to R.drawable.art_btc, "usdt" to R.drawable.art_usdt,
    "eur" to R.drawable.art_eur, "usd" to R.drawable.art_usd,
)

class FavsWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) = refreshNow(context)
    override fun onAppWidgetOptionsChanged(context: Context, mgr: AppWidgetManager, id: Int, options: Bundle) = refreshNow(context)
}

class PriceWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) = refreshNow(context)
    override fun onDeleted(context: Context, ids: IntArray) {
        val prefs = Prefs(context)
        ids.forEach { prefs.remove("widget.$it") }
    }
}

// Opens the app, on a price's detail sheet when itemId is given. The uri keeps each row's intent distinct.
fun openApp(context: Context, itemId: String?): PendingIntent {
    val intent = Intent(context, MainActivity::class.java)
        .setAction(Intent.ACTION_VIEW)
        .setData(Uri.parse(if (itemId == null) "nerkh://home" else "nerkh://item/${Uri.encode(itemId)}"))
    return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
}

// Redraws every نرخ widget. Runs on a worker thread: it fetches the day charts.
fun updateAllWidgets(context: Context, data: NerkhData, board: Board?) {
    val mgr = AppWidgetManager.getInstance(context)
    val favIds = mgr.getAppWidgetIds(ComponentName(context, FavsWidget::class.java))
    val priceIds = mgr.getAppWidgetIds(ComponentName(context, PriceWidget::class.java))
    if (favIds.isEmpty() && priceIds.isEmpty()) return

    val now = System.currentTimeMillis()
    val charts = mutableMapOf<String, List<Double>>()
    val day = { id: String -> charts.getOrPut(id) { data.dayPrices(id) } }

    favIds.forEach { wid ->
        mgr.updateAppWidget(wid, favsViews(context, board, data.favourites(), rowsFor(mgr, wid), now, day))
    }
    priceIds.forEach { wid ->
        val id = data.widgetItem(wid) ?: return@forEach // not configured yet
        mgr.updateAppWidget(wid, priceViews(context, board, id, now, day))
    }
}

// As many rows as the widget's current height holds.
private fun rowsFor(mgr: AppWidgetManager, wid: Int): Int {
    val h = mgr.getAppWidgetOptions(wid).getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
    return if (h == 0) MAX_ROWS - 1 else ((h - HEAD_DP) / ROW_DP).coerceIn(1, MAX_ROWS)
}

private fun favsViews(
    context: Context, board: Board?, favs: List<String>?, rows: Int, now: Long, day: (String) -> List<Double>,
): RemoteViews {
    val rv = RemoteViews(context.packageName, R.layout.widget_favs)
    rv.setOnClickPendingIntent(R.id.head, openApp(context, null))
    rv.removeAllViews(R.id.rows)
    if (board == null) {
        rv.setTextViewText(R.id.ago, "قیمت‌ها هنوز نرسیده")
        return rv
    }
    val shown = pick(board, favs).take(rows)
    shown.forEach { (item, quote) -> rv.addView(R.id.rows, rowViews(context, item, quote, day(item.id))) }
    shown.maxOfOrNull { it.second.updatedAt }?.let { setAgo(context, rv, it, now) }
    return rv
}

private fun rowViews(context: Context, item: Item, quote: Quote, prices: List<Double>): RemoteViews {
    val row = RemoteViews(context.packageName, R.layout.widget_row)
    val art = ART[item.id]
    if (art != null) row.setImageViewResource(R.id.art, art) else row.setTextViewText(R.id.badge, item.badge ?: "")
    row.setTextViewText(R.id.name, item.name)
    row.setTextViewText(R.id.price, faPrice(item, quote.price))
    setPill(row, quote.changePct)
    val spark = sparkBitmap(prices, dp(context, 46), dp(context, 20), trendColor(context, quote.changePct))
    if (spark != null) row.setImageViewBitmap(R.id.spark, spark) else row.setViewVisibility(R.id.spark, View.INVISIBLE)
    row.setOnClickPendingIntent(R.id.row, openApp(context, item.id))
    return row
}

private fun priceViews(context: Context, board: Board?, id: String, now: Long, day: (String) -> List<Double>): RemoteViews {
    val rv = RemoteViews(context.packageName, R.layout.widget_price)
    rv.setOnClickPendingIntent(R.id.root, openApp(context, id))
    val item = board?.items?.get(id)
    val quote = board?.quotes?.get(id)
    if (item == null || quote == null) {
        rv.setTextViewText(R.id.ago, if (board == null) "قیمت‌ها هنوز نرسیده" else "این قیمت دیگر نیست")
        return rv
    }
    rv.setTextViewText(R.id.name, item.name)
    rv.setTextViewText(R.id.price, faPrice(item, quote.price))
    setPill(rv, quote.changePct)
    setAgo(context, rv, quote.updatedAt, now)
    val art = ART[id]
    if (art != null) {
        rv.setImageViewResource(R.id.art, art)
        rv.setViewVisibility(R.id.chart, View.GONE)
    } else {
        rv.setViewVisibility(R.id.art, View.GONE)
        val chart = sparkBitmap(day(id), dp(context, 160), dp(context, 56), trendColor(context, quote.changePct), fill = true)
        if (chart != null) rv.setImageViewBitmap(R.id.chart, chart) else rv.setViewVisibility(R.id.chart, View.GONE)
    }
    return rv
}

// Same arrow + unsigned percent as the app's badges.
private fun setPill(rv: RemoteViews, pct: Double) {
    val (arrow, bg) = when {
        pct > 0 -> "▲" to R.drawable.widget_pill_up
        pct < 0 -> "▼" to R.drawable.widget_pill_down
        else -> "–" to R.drawable.widget_pill_flat
    }
    rv.setTextViewText(R.id.pill, "$arrow ${faPct(pct)}")
    rv.setInt(R.id.pill, "setBackgroundResource", bg)
}

private fun setAgo(context: Context, rv: RemoteViews, updatedAt: Long, now: Long) {
    rv.setTextViewText(R.id.ago, faAgo(updatedAt, now))
    rv.setTextColor(R.id.ago, context.getColor(if (isStale(updatedAt, now)) R.color.widget_down else R.color.widget_label2))
}

private fun trendColor(context: Context, pct: Double) =
    context.getColor(if (pct > 0) R.color.widget_up else if (pct < 0) R.color.widget_down else R.color.widget_flat)

private fun dp(context: Context, v: Int) = (v * context.resources.displayMetrics.density).toInt()
