package ir.nerkh.app

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path

// The small day charts. Widgets can't run our JS chart, so they get a picture of it.

private const val PAD = 0.1f // keeps the line off the top and bottom edge

// Screen points (x, y), oldest left; y grows downward like the canvas.
fun sparkPoints(prices: List<Double>, w: Float, h: Float): List<Pair<Float, Float>> {
    if (prices.size < 2) return emptyList()
    val lo = prices.min()
    val span = prices.max() - lo
    return prices.mapIndexed { i, p ->
        val x = i * w / (prices.size - 1)
        val y = if (span == 0.0) h / 2 else (h * (1 - PAD) - ((p - lo) / span).toFloat() * h * (1 - 2 * PAD))
        x to y
    }
}

// `fill` also shades under the line, for the single-price widget.
fun sparkBitmap(prices: List<Double>, w: Int, h: Int, color: Int, fill: Boolean = false): Bitmap? {
    val pts = sparkPoints(prices, w.toFloat(), h.toFloat()).takeIf { it.isNotEmpty() } ?: return null
    val line = Path().apply {
        moveTo(pts[0].first, pts[0].second)
        pts.drop(1).forEach { lineTo(it.first, it.second) }
    }
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    if (fill) {
        val area = Path(line).apply { lineTo(w.toFloat(), h.toFloat()); lineTo(0f, h.toFloat()); close() }
        canvas.drawPath(area, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color; alpha = 56 })
    }
    val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        style = Paint.Style.STROKE
        strokeWidth = h / 14f
        strokeJoin = Paint.Join.ROUND
        strokeCap = Paint.Cap.ROUND
    }
    canvas.drawPath(line, stroke)
    return bmp
}
