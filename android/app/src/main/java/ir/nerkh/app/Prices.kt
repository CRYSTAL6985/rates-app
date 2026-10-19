package ir.nerkh.app

import org.json.JSONObject
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

// The server's /api/quotes answer, and the same Persian formatting as public/format.js.

// badge: the flag, symbol or glyph the app shows when a price has no 3D art.
data class Item(val id: String, val name: String, val short: String?, val unit: String, val badge: String? = null)
data class Quote(val id: String, val price: Double, val changePct: Double, val updatedAt: Long)
data class Board(val items: Map<String, Item>, val quotes: Map<String, Quote>, val top: List<String>)

const val STALE_MS = 6 * 3_600_000L

fun parseBoard(json: String): Board {
    val root = JSONObject(json)
    val items = root.getJSONArray("items").let { a ->
        (0 until a.length()).map { a.getJSONObject(it) }.associate { o ->
            val id = o.getString("id")
            val badge = listOf("flag", "sym", "glyph").firstOrNull { o.has(it) }?.let { o.getString(it) }
            id to Item(id, o.getString("name"), if (o.has("short")) o.getString("short") else null, o.getString("unit"), badge)
        }
    }
    val quotes = root.getJSONArray("quotes").let { a ->
        (0 until a.length()).map { a.getJSONObject(it) }.associate { o ->
            val id = o.getString("id")
            id to Quote(id, o.getDouble("price"), o.optDouble("changePct", 0.0), o.getLong("updatedAt"))
        }
    }
    val top = root.getJSONArray("top").let { a -> (0 until a.length()).map { a.getString(it) } }
    return Board(items, quotes, top)
}

fun parseDayPrices(json: String): List<Double> =
    JSONObject(json).getJSONArray("points").let { a -> (0 until a.length()).map { a.getJSONObject(it).getDouble("price") } }

// Favourites (or the server's top row), skipping ids the server no longer lists or has no price for.
fun pick(board: Board, favs: List<String>?): List<Pair<Item, Quote>> =
    (favs?.takeIf { it.isNotEmpty() } ?: board.top).mapNotNull { id ->
        val item = board.items[id] ?: return@mapNotNull null
        val quote = board.quotes[id] ?: return@mapNotNull null
        item to quote
    }

// Formatted with Latin digits first, then mapped: Locale("fa") output differs between Android versions.
private val whole = DecimalFormat("#,##0", DecimalFormatSymbols(Locale.US))
private val twoPlaces = DecimalFormat("#,##0.00", DecimalFormatSymbols(Locale.US))

fun toPersian(latin: String): String = buildString {
    for (c in latin) append(
        when (c) {
            in '0'..'9' -> '۰' + (c - '0')
            ',' -> '٬'
            '.' -> '٫'
            else -> c
        }
    )
}

fun faNumber(v: Long): String = toPersian(whole.format(v))

fun faPrice(item: Item, v: Double): String =
    if (item.unit == "usd") toPersian(twoPlaces.format(v)) + " دلار" else faNumber(v.roundToLong())

fun faPct(v: Double): String = toPersian(twoPlaces.format(abs(v))) + "٪"

fun faAgo(ms: Long, now: Long): String {
    val s = (now - ms) / 1000
    return when {
        s < 60 -> "همین الان"
        s < 3600 -> faNumber(s / 60) + " دقیقه پیش"
        s < 86400 -> faNumber(s / 3600) + " ساعت پیش"
        else -> faNumber(s / 86400) + " روز پیش"
    }
}

fun isStale(ms: Long, now: Long): Boolean = now - ms > STALE_MS
