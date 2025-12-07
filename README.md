# expo-plugin-worklet-cleanup

[![npm version](https://img.shields.io/npm/v/expo-plugin-worklet-cleanup.svg)](https://www.npmjs.com/package/expo-plugin-worklet-cleanup)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An Expo config plugin that prevents iOS crashes when users force-quit apps using worklets (react-native-worklets-core, react-native-reanimated, react-native-filament).

## The Problem

When using worklet-based libraries in React Native, your app may crash with `SIGABRT` when the user force-quits from the iOS app switcher. The crash log typically shows:

```
Exception Type:  EXC_CRASH (SIGABRT)
Thread 1 Crashed:
  facebook::react::ObjCTurboModule::performVoidMethodInvocation
  objc_exception_rethrow
  std::__terminate
```

This happens because:
1. User swipes up to force-quit the app
2. Worklets on background threads continue executing
3. Worklets try to access the React Native bridge as it's being torn down
4. Unhandled exception → crash

## The Solution

This plugin adds an `applicationWillTerminate` handler to your iOS `AppDelegate.swift` that notifies the React Native bridge to invalidate before worklets can cause a crash.

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

The plugin adds this method to your `AppDelegate.swift`:

```swift
public override func applicationWillTerminate(_ application: UIApplication) {
    NotificationCenter.default.post(
        name: NSNotification.Name("RCTBridgeWillInvalidateNotification"),
        object: self
    )
    super.applicationWillTerminate(application)
}
```

This notification tells the React Native bridge to begin cleanup, which cancels pending worklet operations before they can crash.

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

### Stop rendering when app is inactive

```typescript
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

function My3DViewer() {
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setIsActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  if (!isActive) {
    return <View style={styles.placeholder} />;
  }

  return <FilamentView>{/* ... */}</FilamentView>;
}
```

### Early bail-out in render callbacks

```typescript
const isActive = useSharedValue(true);

useEffect(() => {
  return () => {
    isActive.value = false;
  };
}, []);

useRenderCallback(() => {
  'worklet';
  if (!isActive.value) return;
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
