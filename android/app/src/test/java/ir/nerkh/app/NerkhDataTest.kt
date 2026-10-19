package ir.nerkh.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.IOException

class MemoryPrefs(private val map: MutableMap<String, String> = mutableMapOf()) : KeyValue {
    override fun get(k: String) = map[k]
    override fun put(k: String, v: String) { map[k] = v }
    override fun remove(k: String) { map.remove(k) }
}

// Answers with `body`, or throws when it is null; records every request.
class FakeHttp(var body: String?) : Http {
    val calls = mutableListOf<Pair<String, Map<String, String>>>()
    override fun get(url: String, headers: Map<String, String>): String {
        calls += url to headers
        return body ?: throw IOException("server down")
    }
}

class NerkhDataTest {
    private val quotes = javaClass.getResource("/quotes.json")!!.readText()

    @Test fun `cache survives a failed fetch`() {
        val http = FakeHttp(quotes)
        val data = NerkhData(MemoryPrefs(), http, "http://pc:3000")
        val first = data.board()
        assertEquals("http://pc:3000/api/quotes", http.calls.single().first)

        http.body = null
        assertEquals(first, data.board())
    }

    @Test fun `nothing fetched and nothing cached gives no board`() {
        assertNull(NerkhData(MemoryPrefs(), FakeHttp(null), "http://pc:3000").board())
    }

    @Test fun `a junk answer does not replace the cache`() {
        val http = FakeHttp(quotes)
        val data = NerkhData(MemoryPrefs(), http, "http://pc:3000")
        val first = data.board()
        http.body = "<html>bad gateway</html>"
        assertEquals(first, data.board())
    }

    @Test fun `missing favourites fall back to top`() {
        val data = NerkhData(MemoryPrefs(), FakeHttp(quotes), "http://pc:3000")
        assertNull(data.favourites())
        val board = data.board()!!
        assertEquals(board.top, pick(board, data.favourites()).map { it.first.id })
    }

    @Test fun `saved favourites and device are read back`() {
        val prefs = MemoryPrefs(mutableMapOf("favs" to """["usd","g18"]""", "device" to "abc"))
        val data = NerkhData(prefs, FakeHttp(quotes), "http://pc:3000")
        assertEquals(listOf("usd", "g18"), data.favourites())
        assertEquals("abc", data.device())
    }

    @Test fun `junk favourites are ignored`() {
        val data = NerkhData(MemoryPrefs(mutableMapOf("favs" to "{oops")), FakeHttp(quotes), "http://pc:3000")
        assertNull(data.favourites())
    }

    @Test fun `day prices are empty when the server is down`() {
        assertEquals(emptyList<Double>(), NerkhData(MemoryPrefs(), FakeHttp(null), "http://pc:3000").dayPrices("usd"))
    }
}
