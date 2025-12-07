# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-07

### Added

- Initial release
- Adds `applicationWillTerminate` handler to iOS AppDelegate.swift
- Posts `RCTBridgeWillInvalidateNotification` to cancel pending worklet operations
- Prevents crashes when users force-quit apps using worklets
- Support for Expo SDK 49+ with Swift AppDelegate
