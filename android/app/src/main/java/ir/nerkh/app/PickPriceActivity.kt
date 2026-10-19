package ir.nerkh.app

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import kotlin.concurrent.thread

// Opens when a single-price widget is added: a list of every price, tap one and the widget shows it.
class PickPriceActivity : AppCompatActivity() {
    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Leaving without a choice tells the launcher not to place the widget.
        setResult(RESULT_CANCELED)
        widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return finish()
        title = "کدام قیمت؟"
        load()
    }

    private fun data() = NerkhData(Prefs(this), UrlHttp(), serverUrl(this))

    private fun load() {
        show(TextView(this).apply { text = "در حال دریافت قیمت‌ها…"; pad() })
        thread {
            val board = data().board()
            runOnUiThread { if (board == null) showOffline() else showList(board) }
        }
    }

    private fun showList(board: Board) {
        val items = board.items.values.toList()
        val list = ListView(this)
        list.adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, items.map { it.name })
        list.setOnItemClickListener { _, _, pos, _ -> choose(items[pos].id) }
        show(list)
    }

    private fun showOffline() {
        val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL; pad() }
        box.addView(TextView(this).apply { text = "به سرور نرخ وصل نشد. اینترنت را بررسی کنید." })
        box.addView(Button(this).apply { text = "دوباره"; setOnClickListener { load() } })
        show(box)
    }

    private fun choose(itemId: String) {
        data().setWidgetItem(widgetId, itemId)
        refreshNow(this)
        setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
        finish()
    }

    private fun show(view: View) {
        view.layoutDirection = View.LAYOUT_DIRECTION_RTL
        setContentView(view)
    }

    private fun View.pad() {
        val p = (24 * resources.displayMetrics.density).toInt()
        setPadding(p, p, p, p)
    }
}
