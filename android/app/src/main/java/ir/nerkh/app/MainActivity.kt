package ir.nerkh.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import com.getcapacitor.BridgeActivity

// The app itself: Capacitor's WebView showing the نرخ server, plus our plugin and the widget taps.
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(NerkhPlugin::class.java)
        super.onCreate(savedInstanceState)
        openItem(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        openItem(intent)
    }

    override fun onResume() {
        super.onResume()
        refreshNow(this)
    }

    // A widget row or notification sends nerkh://item/<id>; the web app opens ?item=<id> on its sheet.
    private fun openItem(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme != "nerkh" || uri.host != "item") return
        val id = uri.lastPathSegment ?: return
        bridge.webView.loadUrl("${serverUrl(this)}/?item=${Uri.encode(id)}")
    }
}
