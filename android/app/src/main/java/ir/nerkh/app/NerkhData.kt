package ir.nerkh.app

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

// Talks to the نرخ server for the widgets and the background alert check, keeping the last good prices.

private const val TAG = "nerkh"
private const val TIMEOUT_MS = 10_000
private const val CACHE_KEY = "cache.quotes"

// The address `npx cap sync` baked into the app, so there is only one copy of it.
fun serverUrl(context: Context): String =
    context.assets.open("capacitor.config.json").bufferedReader().use { JSONObject(it.readText()) }
        .getJSONObject("server").getString("url").trimEnd('/')

interface Http {
    fun get(url: String, headers: Map<String, String> = emptyMap()): String
}

class UrlHttp : Http {
    override fun get(url: String, headers: Map<String, String>): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = TIMEOUT_MS
            conn.readTimeout = TIMEOUT_MS
            headers.forEach { (k, v) -> conn.setRequestProperty(k, v) }
            if (conn.responseCode !in 200..299) throw IOException("HTTP ${conn.responseCode} for $url")
            return conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }
}

interface KeyValue {
    fun get(k: String): String?
    fun put(k: String, v: String)
    fun remove(k: String)
}

// The same storage the web app writes through Capacitor Preferences.
class Prefs(context: Context) : KeyValue {
    private val sp = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
    override fun get(k: String): String? = sp.getString(k, null)
    override fun put(k: String, v: String) { sp.edit().putString(k, v).apply() }
    override fun remove(k: String) { sp.edit().remove(k).apply() }
}

class NerkhData(private val prefs: KeyValue, private val http: Http, private val base: String) {

    // Fresh prices when the server answers, else the last ones saved (their updatedAt shows how old).
    fun board(): Board? {
        try {
            val json = http.get("$base/api/quotes")
            val board = parseBoard(json)
            prefs.put(CACHE_KEY, json)
            return board
        } catch (e: Exception) {
            Log.w(TAG, "prices not fetched, using the saved ones: $e")
        }
        val cached = prefs.get(CACHE_KEY) ?: return null
        return try {
            parseBoard(cached)
        } catch (e: Exception) {
            Log.w(TAG, "saved prices unreadable: $e")
            null
        }
    }

    fun dayPrices(id: String): List<Double> = try {
        parseDayPrices(http.get("$base/api/history/$id?range=day"))
    } catch (e: Exception) {
        Log.w(TAG, "day chart for $id not fetched: $e")
        emptyList()
    }

    // null when the app was never opened or the saved value is junk; the caller then uses the server's top row.
    fun favourites(): List<String>? {
        val raw = prefs.get("favs") ?: return null
        return try {
            JSONArray(raw).let { a -> (0 until a.length()).map { a.getString(it) } }
        } catch (e: Exception) {
            Log.w(TAG, "favourites unreadable: $e")
            null
        }
    }

    fun device(): String? = prefs.get("device")

    // Raw /api/alerts answer for this device; throws when the server is unreachable.
    fun alerts(device: String): String = http.get("$base/api/alerts", mapOf("X-Device" to device))

    // Which price each single-price widget shows, chosen in PickPriceActivity.
    fun widgetItem(widgetId: Int): String? = prefs.get("widget.$widgetId")
    fun setWidgetItem(widgetId: Int, itemId: String) = prefs.put("widget.$widgetId", itemId)
}
