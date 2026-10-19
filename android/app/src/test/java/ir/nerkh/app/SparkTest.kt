package ir.nerkh.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SparkTest {
    @Test fun `a flat day sits at mid height`() {
        val pts = sparkPoints(listOf(5.0, 5.0, 5.0), 100f, 40f)
        assertEquals(3, pts.size)
        assertTrue(pts.all { it.second == 20f })
    }

    @Test fun `a rising day ends higher on screen`() {
        val pts = sparkPoints(listOf(1.0, 2.0, 3.0), 100f, 40f)
        assertTrue(pts.last().second < pts.first().second)
        assertEquals(0f, pts.first().first)
        assertEquals(100f, pts.last().first)
    }

    @Test fun `fewer than two prices draw nothing`() {
        assertEquals(emptyList<Pair<Float, Float>>(), sparkPoints(listOf(1.0), 100f, 40f))
        assertEquals(emptyList<Pair<Float, Float>>(), sparkPoints(emptyList(), 100f, 40f))
    }
}
