/**
 * expo-plugin-worklet-cleanup
 *
 * Expo config plugin to prevent worklet crashes on iOS app force-quit.
 *
 * When using react-native-worklets-core, react-native-reanimated, or
 * react-native-filament, the app can crash with SIGABRT/EXC_BAD_ACCESS when
 * the user force-quits from the app switcher. This happens because:
 * 1. Native module cleanup runs during backgrounding/termination
 * 2. Cleanup code throws exceptions
 * 3. React tries to marshal exceptions to JS
 * 4. Hermes runtime is already torn down or accessed from wrong thread
 *
 * This plugin adds cleanup code to AppDelegate that:
 * 1. Posts notifications when app enters background (preparation phase)
 * 2. Posts bridge invalidation notification on termination (cleanup phase)
 *
 * Note: applicationWillTerminate is NOT reliably called on iOS 13+ when users
 * swipe away apps in the app switcher. The background notification provides
 * an earlier signal that native modules can use to prepare for termination.
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
 * The cleanup methods to inject into AppDelegate.swift
 *
 * We add two handlers:
 * 1. applicationDidEnterBackground - Posts early warning notification
 * 2. applicationWillTerminate - Posts bridge invalidation notification
 *
 * The background notification allows native modules to pause operations
 * gracefully before potential termination. This is especially important
 * for 3D renderers like Filament that have complex native cleanup.
 */
const CLEANUP_METHODS = `
  // Background notification to allow native modules to prepare for potential termination
  // Added by expo-plugin-worklet-cleanup
  public override func applicationDidEnterBackground(_ application: UIApplication) {
    // Post notification that app is entering background
    // Native modules can listen to this to pause operations gracefully
    NotificationCenter.default.post(
      name: NSNotification.Name("RNAppDidEnterBackground"),
      object: self
    )
    super.applicationDidEnterBackground(application)
  }

  // Cleanup on app termination to prevent worklet crashes during force-quit
  // Added by expo-plugin-worklet-cleanup
  // Note: This is NOT reliably called on iOS 13+ for app switcher kills
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
 * This modifies the Swift AppDelegate to add lifecycle handlers that post
 * notifications to help native modules prepare for and handle termination:
 * - applicationDidEnterBackground: Early warning for native modules
 * - applicationWillTerminate: Bridge invalidation for cleanup
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

    // Check if we've already added the cleanup methods
    const hasTerminate = contents.includes('applicationWillTerminate');
    const hasBackground = contents.includes('applicationDidEnterBackground');

    if (hasTerminate && hasBackground) {
      console.log(
        '[expo-worklet-cleanup] Cleanup methods already exist, skipping'
      );
      return config;
    }

    // If only one exists, warn but don't duplicate
    if (hasTerminate || hasBackground) {
      console.log(
        '[expo-worklet-cleanup] Partial cleanup methods exist:',
        { hasTerminate, hasBackground }
      );
      console.log(
        '[expo-worklet-cleanup] Skipping to avoid duplication. Consider updating manually.'
      );
      return config;
    }

    // Strategy 1: Find the end of AppDelegate class (before ReactNativeDelegate)
    const classEndRegex = /(\n})\s*\n\s*(class ReactNativeDelegate)/;

    if (classEndRegex.test(contents)) {
      contents = contents.replace(classEndRegex, `${CLEANUP_METHODS}$1\n\n$2`);
      console.log(
        '[expo-worklet-cleanup] Added cleanup methods to AppDelegate.swift'
      );
      appDelegate.contents = contents;
      return config;
    }

    // Strategy 2: Look for the continue userActivity method (typically last)
    const lastMethodRegex =
      /(continue userActivity: NSUserActivity,[\s\S]*?return[^}]*}\s*\n)(})/;

    if (lastMethodRegex.test(contents)) {
      contents = contents.replace(lastMethodRegex, `$1${CLEANUP_METHODS}$2`);
      console.log(
        '[expo-worklet-cleanup] Added cleanup methods to AppDelegate.swift (fallback strategy)'
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
            `$1${CLEANUP_METHODS}$2`
          );
          console.log(
            '[expo-worklet-cleanup] Added cleanup methods to AppDelegate.swift (generic strategy)'
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
      '[expo-worklet-cleanup] Please manually add the lifecycle methods to your AppDelegate'
    );

    return config;
  });
};

export default withWorkletCleanup;
