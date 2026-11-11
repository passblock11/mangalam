import Flutter
import Firebase
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Configure Firebase before the Flutter engine starts so FCM is ready.
    FirebaseApp.configure()

    // Required for firebase_messaging to show notifications while app is in
    // the foreground and to handle background/terminated message taps.
    if #available(iOS 10.0, *) {
      UNUserNotificationCenter.current().delegate = self as UNUserNotificationCenterDelegate
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }

  // Forward APNS token to Firebase so FCM can target this device.
  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    #if DEBUG
    print("APNS token registered (\(deviceToken.count) bytes)")
    #endif
    // firebase_messaging's plugin handles the bridging; nothing extra needed
    // here when FirebaseAppDelegateProxyEnabled is false, but keep the hook.
  }
}
