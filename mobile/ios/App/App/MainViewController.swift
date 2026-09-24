import UIKit
import Capacitor

/// The app's one window onto the hosted site: Capacitor's view controller plus
/// the plugins that live in this project rather than in node_modules, which
/// Capacitor 8 does not find on its own.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        // Off until the page asks for it through CommuneNav.
        webView?.allowsBackForwardNavigationGestures = false
        bridge?.registerPluginInstance(CommuneNavPlugin())

        // The page's own ground (--bg-main), light or dark with the phone, so a
        // launch or a reload in dark mode never flashes white before it paints.
        let ground = UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(red: 23 / 255, green: 23 / 255, blue: 23 / 255, alpha: 1)
                : UIColor.white
        }
        view.backgroundColor = ground
        webView?.isOpaque = false
        webView?.backgroundColor = ground
        webView?.scrollView.backgroundColor = ground
    }
}
