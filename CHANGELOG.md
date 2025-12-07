# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2024-12-07

### Added

- **New:** `applicationDidEnterBackground` handler for early warning notifications
- Posts `RNAppDidEnterBackground` notification when app enters background
- Native modules can listen for this to prepare for potential termination

### Changed

- Now adds two lifecycle handlers instead of one
- Better detection of existing methods to avoid duplication
- Improved documentation with crash prevention patterns

### Why Major Version?

The `applicationWillTerminate` method is **not reliably called** on iOS 13+ when users swipe away apps in the app switcher. This version adds `applicationDidEnterBackground` as a more reliable signal for native modules to prepare for termination.

This is a breaking change because:
1. Apps using v1.x will now get an additional lifecycle method injected
2. The new notification (`RNAppDidEnterBackground`) may trigger behavior in native modules listening for it

## [1.0.0] - 2024-12-07

### Added

- Initial release
- Adds `applicationWillTerminate` handler to iOS AppDelegate.swift
- Posts `RCTBridgeWillInvalidateNotification` to cancel pending worklet operations
- Prevents crashes when users force-quit apps using worklets
- Support for Expo SDK 49+ with Swift AppDelegate
