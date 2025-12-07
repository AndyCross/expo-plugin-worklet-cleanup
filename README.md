# expo-plugin-worklet-cleanup

[![npm version](https://img.shields.io/npm/v/expo-plugin-worklet-cleanup.svg)](https://www.npmjs.com/package/expo-plugin-worklet-cleanup)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An Expo config plugin that prevents iOS crashes when users force-quit apps using worklets (react-native-worklets-core, react-native-reanimated, react-native-filament).

## The Problem

When using worklet-based libraries in React Native, your app may crash with `SIGABRT` or `EXC_BAD_ACCESS` when the user force-quits from the iOS app switcher. The crash log typically shows:

```
Exception Type:  EXC_CRASH (SIGABRT)
Thread 1 Crashed:
  facebook::react::ObjCTurboModule::performVoidMethodInvocation
  objc_exception_rethrow
  std::__terminate
```

Or for 3D renderers like Filament:

```
Exception Type:  EXC_BAD_ACCESS (SIGSEGV)
Thread 1 Crashed:
  convertNSExceptionToJSError
  filament::FEngine::destroy
```

This happens because:
1. User opens app switcher (app enters background/inactive state)
2. Native module cleanup begins (e.g., Filament teardown)
3. Cleanup throws an exception
4. React tries to marshal the exception to JavaScript
5. Hermes runtime is already torn down or accessed from wrong thread → **crash**

### Why `applicationWillTerminate` isn't enough

On iOS 13+, `applicationWillTerminate` is **not reliably called** when users swipe away apps in the app switcher. iOS often just kills the process without calling it. This plugin addresses that by also posting notifications when the app enters the background.

## The Solution

This plugin adds lifecycle handlers to your iOS `AppDelegate.swift` that post notifications for native modules to prepare for and handle termination safely:

1. **`applicationDidEnterBackground`** - Posts early warning notification
2. **`applicationWillTerminate`** - Posts bridge invalidation notification (when called)

## Installation

```bash
npm install expo-plugin-worklet-cleanup
# or
yarn add expo-plugin-worklet-cleanup
```

## Setup

### 1. Add the Plugin

Add to your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "plugins": ["expo-plugin-worklet-cleanup"]
  }
}
```

### 2. Rebuild Your App

```bash
npx expo prebuild --clean
npx expo run:ios
```

That's it! The plugin automatically adds the cleanup code during prebuild.

## What It Does

The plugin adds these methods to your `AppDelegate.swift`:

```swift
// Early warning when app enters background (always called)
public override func applicationDidEnterBackground(_ application: UIApplication) {
    NotificationCenter.default.post(
        name: NSNotification.Name("RNAppDidEnterBackground"),
        object: self
    )
    super.applicationDidEnterBackground(application)
}

// Bridge invalidation on termination (not always called on iOS 13+)
public override func applicationWillTerminate(_ application: UIApplication) {
    NotificationCenter.default.post(
        name: NSNotification.Name("RCTBridgeWillInvalidateNotification"),
        object: self
    )
    super.applicationWillTerminate(application)
}
```

### Notifications

| Notification | When | Use Case |
|-------------|------|----------|
| `RNAppDidEnterBackground` | App enters background | Pause render callbacks, prepare for potential termination |
| `RCTBridgeWillInvalidateNotification` | App terminating | Cancel pending worklet operations |

The background notification is the more reliable signal since it's always called, unlike `applicationWillTerminate`.

## Affected Libraries

This plugin helps prevent crashes when using:

- **react-native-worklets-core** - The worklet runtime used by other libraries
- **react-native-reanimated** - Animation library using worklets
- **react-native-filament** - 3D rendering using worklets for render callbacks
- **react-native-skia** - 2D graphics with worklet support
- **vision-camera** - Camera with frame processor worklets

## Additional Recommendations

While this plugin helps at the native level, you should also add JS-side cleanup:

### Cancel animations on component unmount

```typescript
import { useEffect } from 'react';
import { cancelAnimation, useSharedValue } from 'react-native-reanimated';

function MyComponent() {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    return () => {
      cancelAnimation(animatedValue);
    };
  }, []);

  // ...
}
```

### Pause rendering when app is inactive (DON'T unmount!)

**Important:** Don't conditionally unmount 3D views when the app backgrounds. Unmounting triggers native cleanup which can race with Hermes teardown and crash. Instead, keep the view mounted but skip rendering:

```typescript
import { useEffect, useState } from 'react';
import { AppState, View, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-worklets-core';

function My3DViewer() {
  const [isActive, setIsActive] = useState(AppState.currentState === 'active');
  const isActiveShared = useSharedValue(true);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      setIsActive(active);
      isActiveShared.value = active;
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.container}>
      {/* Always keep FilamentScene mounted - never conditionally unmount! */}
      <FilamentScene>
        <SceneContent isAppActive={isActiveShared} />
      </FilamentScene>
      {/* Overlay when paused */}
      {!isActive && <View style={StyleSheet.absoluteFill} />}
    </View>
  );
}

// In your render callback:
useRenderCallback(() => {
  'worklet';
  // Skip rendering when backgrounded - prevents race conditions
  if (!isAppActive.value) return;
  // ... render logic
});
```

### Guard worklet execution on unmount

```typescript
const isSceneActive = useSharedValue(true);

useEffect(() => {
  isSceneActive.value = true;
  return () => {
    // Mark inactive before unmount to prevent worklet crashes
    isSceneActive.value = false;
  };
}, []);

useRenderCallback(() => {
  'worklet';
  // Bail out if scene is being torn down
  if (!isSceneActive.value) return;
  // ... render logic
});
```

## Platform Support

| Platform | Supported |
|----------|-----------|
| iOS      | ✅        |
| Android  | ❌ (not needed) |

Android doesn't have this issue because it handles app termination differently.

## Requirements

- Expo SDK 49+
- iOS (Swift AppDelegate)

## Troubleshooting

### Plugin not working

Make sure you've run `npx expo prebuild --clean` after adding the plugin.

### Still seeing crashes

The native cleanup helps but may not catch 100% of race conditions. Combine with the JS-side cleanup recommendations above.

### Objective-C AppDelegate

This plugin currently only supports Swift AppDelegate (Expo SDK 50+ default). For Objective-C support, please open an issue.

## Contributing

Contributions are welcome! Please open an issue or PR.

## License

MIT
