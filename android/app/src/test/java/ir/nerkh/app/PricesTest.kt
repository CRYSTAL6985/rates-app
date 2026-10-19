package ir.nerkh.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PricesTest {
    private val toman = Item("usd", "دلار آمریکا", "دلار", "toman")
    private val ounce = Item("goz", "انس طلا", null, "usd")
    private val board = parseBoard(javaClass.getResource("/quotes.json")!!.readText())

    @Test fun `toman prices are whole numbers with Persian separators`() {
        assertEquals("۲۶٬۲۰۷٬۶۰۰", faPrice(toman, 26207600.4))
    }

    @Test fun `dollar prices keep two decimals`() {
        assertEquals("۴٬۱۶۷٫۲۲ دلار", faPrice(ounce, 4167.22))
        assertEquals("۰٫۵۰ دلار", faPrice(ounce, 0.5))
    }

    @Test fun `percent is unsigned`() {
        assertEquals("۰٫۱۰٪", faPct(-0.1))
        assertEquals("۱٫۵۵٪", faPct(1.55))
    }

    @Test fun `ago shows minutes, hours and days`() {
        val now = 1_800_000_000_000L
        assertEquals("همین الان", faAgo(now - 30_000, now))
        assertEquals("۵ دقیقه پیش", faAgo(now - 5 * 60_000, now))
        assertEquals("۳ ساعت پیش", faAgo(now - 3 * 3_600_000, now))
        assertEquals("۲ روز پیش", faAgo(now - 2 * 86_400_000, now))
    }

    @Test fun `older than six hours is stale`() {
        val now = 1_800_000_000_000L
        assertTrue(isStale(now - 6 * 3_600_000 - 1, now))
        assertFalse(isStale(now - 5 * 3_600_000, now))
    }

    @Test fun `board reads items, quotes and the default top row`() {
        assertEquals(listOf("g18", "usd", "usdt"), board.top)
        assertEquals(263800.0, board.quotes.getValue("usd").price, 0.0)
        assertEquals("دلار", board.items.getValue("usd").short)
        assertEquals(null, board.items.getValue("usdt").short)
    }

    @Test fun `unknown favourite ids are skipped`() {
        assertEquals(listOf("usd"), pick(board, listOf("gone", "usd")).map { it.first.id })
        assertEquals(board.top, pick(board, null).map { it.first.id })
        assertEquals(board.top, pick(board, emptyList()).map { it.first.id })
    }

    @Test fun `day prices come oldest first`() {
        assertEquals(listOf(1.0, 2.5), parseDayPrices("""{"points":[{"t":1,"price":1},{"t":2,"price":2.5}]}"""))
        assertEquals(emptyList<Double>(), parseDayPrices("""{"points":[]}"""))
    }
}
