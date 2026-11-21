import AppKit
import WebKit

// Loads one page in an offscreen WKWebView and prints one line of JSON saying
// what the page shows. Run by tests/blocking/run.mjs.
//   probe <url> [--list rules.json]... [--script start.js]
// --list compiles a WebKit content rule list, as a Mac or Linux app does.
// --script runs at document start in every frame, as the Windows runtime's
// hiding script does.
var args = Array(CommandLine.arguments.dropFirst())
guard let first = args.first, let url = URL(string: first) else {
    print("{\"error\":\"usage\"}")
    exit(64)
}
args.removeFirst()
var lists: [String] = []
var scripts: [String] = []
while args.count >= 2 {
    if args[0] == "--list" { lists.append(args[1]) }
    if args[0] == "--script" { scripts.append(args[1]) }
    args.removeFirst(2)
}
let settle = Double(ProcessInfo.processInfo.environment["PROBE_SETTLE"] ?? "5") ?? 5
let limit = Double(ProcessInfo.processInfo.environment["PROBE_LIMIT"] ?? "75") ?? 75

func finish(_ line: String, _ code: Int32) -> Never {
    print(line)
    exit(code)
}

final class Navigation: NSObject, WKNavigationDelegate {
    var loaded: (() -> Void)?
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loaded?() }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        loaded?()
    }
    func webView(
        _ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        finish("{\"error\":\"load\"}", 3)
    }
}

let report = """
    (() => {
      const shown = (e) => getComputedStyle(e).display !== 'none';
      const all = [...document.querySelectorAll('body *')];
      const svg = [...document.querySelectorAll('svg')];
      const img = [...document.images];
      return JSON.stringify({
        href: location.href,
        elements: all.length,
        visible: all.filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').length,
        text: (document.body.innerText || '').length,
        svg: svg.length,
        svgHidden: svg.filter((e) => !shown(e)).length,
        img: img.length,
        imgHidden: img.filter((e) => !shown(e)).length,
        styles: document.querySelectorAll('style[data-pake-blocking]').length,
      });
    })()
    """

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
let config = WKWebViewConfiguration()
config.websiteDataStore = .nonPersistent()
let navigation = Navigation()
var web: WKWebView!

func start() {
    for path in scripts {
        guard let source = try? String(contentsOfFile: path, encoding: .utf8) else {
            finish("{\"error\":\"script\"}", 65)
        }
        config.userContentController.addUserScript(
            WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: false))
    }
    web = WKWebView(frame: NSRect(x: 0, y: 0, width: 1200, height: 800), configuration: config)
    web.customUserAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15"
    web.navigationDelegate = navigation
    navigation.loaded = {
        navigation.loaded = nil
        DispatchQueue.main.asyncAfter(deadline: .now() + settle) {
            web.evaluateJavaScript(report) { value, _ in
                guard let line = value as? String else { finish("{\"error\":\"script\"}", 4) }
                finish(line, 0)
            }
        }
    }
    web.load(URLRequest(url: url))
}

// One store per run, so a list compiled for the first page serves the rest
// and the folder goes away with the run.
let storeDir = ProcessInfo.processInfo.environment["PROBE_STORE"] ?? NSTemporaryDirectory()
guard let store = WKContentRuleListStore(url: URL(fileURLWithPath: storeDir, isDirectory: true))
else { finish("{\"error\":\"store\"}", 65) }

var pending = lists.count
func added(_ list: WKContentRuleList) {
    config.userContentController.add(list)
    pending -= 1
    if pending == 0 { start() }
}
if pending == 0 { start() }
for path in lists {
    let identifier = "pake-probe-" + URL(fileURLWithPath: path).lastPathComponent
    store.lookUpContentRuleList(forIdentifier: identifier) { found, _ in
        if let found { return added(found) }
        guard let json = try? String(contentsOfFile: path, encoding: .utf8) else {
            finish("{\"error\":\"list\"}", 65)
        }
        store.compileContentRuleList(forIdentifier: identifier, encodedContentRuleList: json) {
            list, _ in
            guard let list else { finish("{\"error\":\"compile\"}", 5) }
            added(list)
        }
    }
}
DispatchQueue.main.asyncAfter(deadline: .now() + limit) { finish("{\"error\":\"timeout\"}", 2) }
app.run()
