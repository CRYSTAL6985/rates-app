package ir.nerkh.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AlertsTest {
    private val json = """{"alerts":[
        {"id":"a1","item":"usd","direction":"above","target":263500,"repeat":false,"enabled":false,"armed":false,"firedAt":2000,"createdAt":1},
        {"id":"a2","item":"g18","direction":"below","target":26000000,"repeat":false,"enabled":true,"armed":true,"firedAt":null,"createdAt":1},
        {"id":"a3","item":"usdt","direction":"below","target":260000,"repeat":true,"enabled":true,"armed":false,"firedAt":1000,"createdAt":1}
    ]}"""
    private val dollar = Item("usd", "دلار آمریکا", "دلار", "toman")
    private val ounce = Item("goz", "انس طلا", null, "usd")

    @Test fun `alerts are read, unfired ones have no time`() {
        val alerts = parseAlerts(json)
        assertEquals(listOf("a1", "a2", "a3"), alerts.map { it.id })
        assertEquals(null, alerts[1].firedAt)
        assertEquals(263500.0, alerts[0].target, 0.0)
    }

    @Test fun `an alert fires a notification once`() {
        val alerts = parseAlerts(json)
        assertEquals(listOf("a3", "a1"), newlyFired(alerts, 0).map { it.id })
        assertEquals(listOf("a1"), newlyFired(alerts, 1000).map { it.id })
        assertTrue(newlyFired(alerts, 2000).isEmpty())
    }

    @Test fun `no device id means no alert call`() {
        val http = FakeHttp(json)
        val data = NerkhData(MemoryPrefs(), http, "http://pc:3000")
        assertTrue(alertsToNotify(data, 0).isEmpty())
        assertTrue(http.calls.isEmpty())
    }

    @Test fun `alerts are fetched with this device's id`() {
        val http = FakeHttp(json)
        val data = NerkhData(MemoryPrefs(mutableMapOf("device" to "dev-1")), http, "http://pc:3000")
        assertEquals(listOf("a3", "a1"), alertsToNotify(data, 0).map { it.id })
        assertEquals("http://pc:3000/api/alerts" to mapOf("X-Device" to "dev-1"), http.calls.single())
    }

    @Test fun `notification text says which way the price crossed`() {
        val up = Alert("a1", "usd", "above", 263500.0, 2000)
        assertEquals("دلار از ۲۶۳٬۵۰۰ تومان بالاتر رفت" to "الان ۲۶۳٬۸۰۰ تومان است.", alertText(dollar, up, 263800.0))
        val down = Alert("a4", "goz", "below", 4000.0, 2000)
        assertEquals("انس طلا از ۴٬۰۰۰٫۰۰ دلار پایین‌تر آمد" to "الان ۳٬۹۹۸٫۵۰ دلار است.", alertText(ounce, down, 3998.5))
    }
}
