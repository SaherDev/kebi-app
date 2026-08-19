import ExpoModulesCore

/**
 * Receives the results of shares the extension handed to iOS.
 *
 * The extension posts on a background `URLSession` and dies immediately, so the
 * response has nowhere to go but here: iOS relaunches the app (often headless,
 * in the background) to deliver it, and holds the result until the next launch
 * if it cannot. That is what lets a share land while the app is not running and
 * still be accounted for when the user finally opens it.
 *
 * All this does is write the outcome onto the pending record the extension
 * left in the App Group. It renders nothing and knows nothing about the UI —
 * the "while you were away" card reads those records on its own.
 *
 * Failures are absorbed on purpose: an unparseable response, a missing record,
 * a share the user already dismissed. A delivery with nowhere to go is not an
 * error, and this runs during launch, where throwing would be catastrophic.
 */
public class KebiShareSessionSubscriber: ExpoAppDelegateSubscriber, URLSessionDataDelegate {
  /// Must match the extension's session identifier and the app's TS constant —
  /// see plugins/with-silent-share.js and src/lib/share-session-id.ts.
  private static let sessionIdentifier = "app.kebi.share.upload"
  private static let appGroup = "group.app.kebi"
  private static let pendingKey = "kebi.share.pending"
  private static let shareIdHeader = "X-Kebi-Share-Id"

  /// Response bodies accumulate per task; a background upload's body arrives in
  /// chunks like any other.
  private var buffers: [Int: Data] = [:]
  /// Handed to us by iOS when it wakes the app; must be called once we are done
  /// or the system counts it against us.
  private var completionHandler: (() -> Void)?

  private lazy var session: URLSession = {
    let config = URLSessionConfiguration.background(
      withIdentifier: KebiShareSessionSubscriber.sessionIdentifier
    )
    config.sharedContainerIdentifier = KebiShareSessionSubscriber.appGroup
    return URLSession(configuration: config, delegate: self, delegateQueue: nil)
  }()

  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Touch the session on every launch: re-attaching is what makes iOS hand
    // over results it has been holding since the app was last killed.
    _ = session
    return true
  }

  /// Returns Void, matching UIApplicationDelegate exactly. Expo dispatches this
  /// through the protocol selector, so a mismatched signature is at best
  /// fragile — and silently never running is the failure it produces.
  public func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    guard identifier == KebiShareSessionSubscriber.sessionIdentifier else {
      completionHandler()
      return
    }
    self.completionHandler = completionHandler
    _ = session
  }

  public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    buffers[dataTask.taskIdentifier, default: Data()].append(data)
  }

  public func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didCompleteWithError error: Error?
  ) {
    let body = buffers.removeValue(forKey: task.taskIdentifier)
    // The id rides the request, so it survives the process that created it.
    guard let id = task.originalRequest?.value(forHTTPHeaderField: KebiShareSessionSubscriber.shareIdHeader) else {
      return
    }
    // Every path below records *something*. A share whose answer already came
    // and went must never sit as "still working" — a silent system that
    // silently loses things is worse than a slow one, and an unresolvable
    // shimmer is exactly that.
    if error != nil {
      // didCompleteWithError is terminal: iOS has already done its own retries.
      Self.record(id: id, outcome: Self.failure(reason: "network"))
      return
    }

    let status = (task.response as? HTTPURLResponse)?.statusCode ?? 0
    guard (200..<300).contains(status) else {
      // 5xx from kebi, 401 from an expired share token, anything else. The row
      // can offer "try again", which is useless if the row never resolves.
      Self.record(id: id, outcome: Self.failure(reason: status == 401 ? "unauthorized" : "server"))
      return
    }

    // kebi's own "pending" is the one honest reason to record nothing: it took
    // the link and is still working, so the row's shimmer is telling the truth.
    if let body, Self.isPending(body) { return }

    guard let body, let outcome = Self.outcome(from: body) else {
      // 2xx whose body is not an ExtractPlaceResponse — schema drift, an HTML
      // error page from a proxy. Unparseable is a failure, not a pending state.
      Self.record(id: id, outcome: Self.failure(reason: "unreadable"))
      return
    }
    Self.record(id: id, outcome: outcome)
  }

  public func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    DispatchQueue.main.async { [weak self] in
      self?.completionHandler?()
      self?.completionHandler = nil
    }
  }

  /// True when kebi says it has the link but is not finished with it.
  private static func isPending(_ data: Data) -> Bool {
    guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      return false
    }
    return (json["status"] as? String) == "pending"
  }

  private static func failure(reason: String) -> [String: Any] {
    return ["status": "failed", "place_names": [], "failure_reason": reason]
  }

  /// Map kebi's ExtractPlaceResponse onto what the card needs: did it land, what
  /// is it called, and if not, why not.
  private static func outcome(from data: Data) -> [String: Any]? {
    guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let status = json["status"] as? String else { return nil }

    if status == "completed" {
      let results = json["results"] as? [[String: Any]] ?? []
      let names: [String] = results.compactMap { result in
        (result["place"] as? [String: Any])?["place_name"] as? String
      }
      return ["status": "completed", "place_names": names]
    }

    // `pending` means kebi took it but is not done — not an outcome yet, so the
    // row honestly stays in its working state.
    guard status == "failed" else { return nil }
    var outcome: [String: Any] = ["status": "failed", "place_names": []]
    if let reason = json["failure_reason"] as? String {
      outcome["failure_reason"] = reason
    }
    return outcome
  }

  /// Re-read before writing: the extension may have appended a share since this
  /// task started, and a blind overwrite would drop it.
  private static func record(id: String, outcome: [String: Any]) {
    guard let defaults = UserDefaults(suiteName: appGroup),
          let raw = defaults.string(forKey: pendingKey),
          let data = raw.data(using: .utf8),
          var items = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
      return
    }

    var changed = false
    for index in items.indices where items[index]["id"] as? String == id {
      items[index]["outcome"] = outcome
      changed = true
    }
    guard changed else { return }

    guard let encoded = try? JSONSerialization.data(withJSONObject: items),
          let json = String(data: encoded, encoding: .utf8) else { return }
    defaults.set(json, forKey: pendingKey)
  }
}
