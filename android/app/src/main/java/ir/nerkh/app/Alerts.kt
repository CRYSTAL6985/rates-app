package ir.nerkh.app

import org.json.JSONObject

// Price alerts inside the Android app. The server already checks alerts on every poll and stamps
// firedAt; the background worker asks for this device's alerts and notifies the new firings.

data class Alert(val id: String, val item: String, val direction: String, val target: Double, val firedAt: Long?)

fun parseAlerts(json: String): List<Alert> =
    JSONObject(json).getJSONArray("alerts").let { a ->
        (0 until a.length()).map { a.getJSONObject(it) }.map { o ->
            Alert(
                o.getString("id"), o.getString("item"), o.getString("direction"), o.getDouble("target"),
                if (o.isNull("firedAt")) null else o.getLong("firedAt"),
            )
        }
    }

// Fired after `lastSeen`, oldest first, so one firing gives one notification.
fun newlyFired(alerts: List<Alert>, lastSeen: Long): List<Alert> =
    alerts.filter { (it.firedAt ?: 0) > lastSeen }.sortedBy { it.firedAt }

// Throws when the server can't be reached; the worker then tries again next round.
fun alertsToNotify(data: NerkhData, lastSeen: Long): List<Alert> {
    val device = data.device() ?: return emptyList()
    return newlyFired(parseAlerts(data.alerts(device)), lastSeen)
}

private fun amount(item: Item, v: Double) = faPrice(item, v) + if (item.unit == "usd") "" else " تومان"

// (title, body), like «دلار از ۲۶۳٬۵۰۰ تومان بالاتر رفت» / «الان ۲۶۳٬۸۰۰ تومان است.»
fun alertText(item: Item, alert: Alert, price: Double): Pair<String, String> {
    val crossed = if (alert.direction == "above") "بالاتر رفت" else "پایین‌تر آمد"
    return "${item.short ?: item.name} از ${amount(item, alert.target)} $crossed" to "الان ${amount(item, price)} است."
}
