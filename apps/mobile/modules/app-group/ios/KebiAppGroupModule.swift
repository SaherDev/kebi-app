import ExpoModulesCore

/**
 * Shared storage between the app and the "Save to Kebi" share extension.
 *
 * The two run in separate processes with separate sandboxes; an App Group
 * container is the only thing they both see. The app writes the share token here
 * on sign-in and clears it on sign-out, and the extension reads it to
 * authenticate a save while the app is not running (share-and-forget).
 *
 * Deliberately a dumb key/value store over the group's UserDefaults suite — the
 * queue of links the extension could not send lives here too, as JSON under one
 * key. Nothing in here interprets what it holds.
 *
 * Every method fails soft: an App Group that is not entitled (or a typo'd suite)
 * yields nil rather than throwing, so the JS side degrades to "no share token"
 * instead of crashing a save.
 */
public class KebiAppGroupModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KebiAppGroup")

    Function("getItem") { (suite: String, key: String) -> String? in
      guard let defaults = UserDefaults(suiteName: suite) else { return nil }
      return defaults.string(forKey: key)
    }

    Function("setItem") { (suite: String, key: String, value: String) -> Bool in
      guard let defaults = UserDefaults(suiteName: suite) else { return false }
      defaults.set(value, forKey: key)
      return true
    }

    Function("removeItem") { (suite: String, key: String) -> Bool in
      guard let defaults = UserDefaults(suiteName: suite) else { return false }
      defaults.removeObject(forKey: key)
      return true
    }

    /// Whether the App Group is actually reachable — the entitlement is a build
    /// concern, so this is the one honest way to find out at runtime.
    Function("isAvailable") { (suite: String) -> Bool in
      return UserDefaults(suiteName: suite) != nil
    }
  }
}
