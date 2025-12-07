/**
 * expo-plugin-worklet-cleanup
 *
 * Expo config plugin to prevent worklet crashes on iOS app force-quit.
 *
 * When using react-native-worklets-core, react-native-reanimated, or
 * react-native-filament, the app can crash with SIGABRT when the user
 * force-quits from the app switcher. This happens because worklets
 * continue executing while the React Native bridge is being torn down.
 *
 * This plugin adds cleanup code to AppDelegate that notifies the bridge
 * to invalidate before worklets can cause a crash.
 *
 * @example
 * ```json
 * // app.json
 * {
 *   "expo": {
 *     "plugins": ["expo-plugin-worklet-cleanup"]
 *   }
 * }
 * ```
 */

import { ConfigPlugin, withAppDelegate } from '@expo/config-plugins';

/**
 * The cleanup method to inject into AppDelegate.swift
 *
 * This posts a notification to invalidate the React Native bridge,
 * which cancels pending worklet operations and prevents crashes
 * during app termination.
 */
const CLEANUP_METHOD = `
  // Cleanup on app termination to prevent worklet crashes during force-quit
  // Added by expo-worklet-cleanup
  public override func applicationWillTerminate(_ application: UIApplication) {
    // Notify the bridge to invalidate and cancel pending worklet operations
    NotificationCenter.default.post(
      name: NSNotification.Name("RCTBridgeWillInvalidateNotification"),
      object: self
    )
    super.applicationWillTerminate(application)
  }
`;

/**
 * Plugin to add worklet cleanup to iOS AppDelegate
 *
 * This modifies the Swift AppDelegate to add an `applicationWillTerminate`
 * handler that posts a notification to invalidate the React Native bridge
 * before worklets can cause a crash during force-quit.
 *
 * @param config - Expo config
 * @returns Modified config with AppDelegate changes
 */
const withWorkletCleanup: ConfigPlugin = (config) => {
  return withAppDelegate(config, async (config) => {
    const appDelegate = config.modResults;

    // Only modify Swift AppDelegate (Expo SDK 50+ uses Swift by default)
    if (appDelegate.language !== 'swift') {
      console.warn(
        '[expo-worklet-cleanup] Expected Swift AppDelegate, found:',
        appDelegate.language
      );
      console.warn(
        '[expo-worklet-cleanup] Skipping modification. For Objective-C support, please open an issue.'
      );
      return config;
    }

    let contents = appDelegate.contents;

    // Check if we've already added the cleanup
    if (contents.includes('applicationWillTerminate')) {
      console.log(
        '[expo-worklet-cleanup] applicationWillTerminate already exists, skipping'
      );
      return config;
    }

    // Strategy 1: Find the end of AppDelegate class (before ReactNativeDelegate)
    const classEndRegex = /(\n})\s*\n\s*(class ReactNativeDelegate)/;

    if (classEndRegex.test(contents)) {
      contents = contents.replace(classEndRegex, `${CLEANUP_METHOD}$1\n\n$2`);
      console.log(
        '[expo-worklet-cleanup] Added cleanup method to AppDelegate.swift'
      );
      appDelegate.contents = contents;
      return config;
    }

    // Strategy 2: Look for the continue userActivity method (typically last)
    const lastMethodRegex =
      /(continue userActivity: NSUserActivity,[\s\S]*?return[^}]*}\s*\n)(})/;

    if (lastMethodRegex.test(contents)) {
      contents = contents.replace(lastMethodRegex, `$1${CLEANUP_METHOD}$2`);
      console.log(
        '[expo-worklet-cleanup] Added cleanup method to AppDelegate.swift (fallback strategy)'
      );
      appDelegate.contents = contents;
      return config;
    }

    // Strategy 3: Find the last method before the closing brace of the class
    // Look for pattern: method ending with } followed by class closing }
    const genericMethodEndRegex = /(}\s*\n)(}\s*(?:\n|$))/;

    if (genericMethodEndRegex.test(contents)) {
      // Only apply if this looks like the end of AppDelegate class
      const match = contents.match(genericMethodEndRegex);
      if (match && match.index !== undefined) {
        // Check if this is near the end and before any other class definition
        const afterMatch = contents.slice(match.index + match[0].length);
        if (
          !afterMatch.includes('class ') ||
          afterMatch.indexOf('class ') > 50
        ) {
          contents = contents.replace(
            genericMethodEndRegex,
            `$1${CLEANUP_METHOD}$2`
          );
          console.log(
            '[expo-worklet-cleanup] Added cleanup method to AppDelegate.swift (generic strategy)'
          );
          appDelegate.contents = contents;
          return config;
        }
      }
    }

    console.warn(
      '[expo-worklet-cleanup] Could not find suitable insertion point in AppDelegate.swift'
    );
    console.warn(
      '[expo-worklet-cleanup] Please manually add applicationWillTerminate to your AppDelegate'
    );

    return config;
  });
};

export default withWorkletCleanup;
