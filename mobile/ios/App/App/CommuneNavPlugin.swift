import Capacitor
import WebKit

/// Lets the page decide when an edge swipe goes back.
///
/// WKWebView's back-forward gesture walks the web view's own history, which in
/// a single-page app is every route change, and it fights any horizontal
/// gesture the page runs itself. So it starts off, and the page turns it on
/// only where a swipe back means what the person expects:
///
///     window.Capacitor.Plugins.CommuneNav.setSwipeBackEnabled({ enabled: true })
///
/// iOS only. Android has the system back gesture, which Capacitor's App plugin
/// reports to the page as `backButton`.
@objc(CommuneNavPlugin)
public class CommuneNavPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CommuneNavPlugin"
    public let jsName = "CommuneNav"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSwipeBackEnabled", returnType: CAPPluginReturnPromise)
    ]

    @objc func setSwipeBackEnabled(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else {
            call.reject("setSwipeBackEnabled needs { enabled: boolean }")
            return
        }
        // Plugin calls arrive off the main thread; the web view is UIKit.
        DispatchQueue.main.async { [weak self] in
            self?.bridge?.webView?.allowsBackForwardNavigationGestures = enabled
            call.resolve()
        }
    }
}
