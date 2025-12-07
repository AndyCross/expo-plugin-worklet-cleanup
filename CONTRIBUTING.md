# Contributing to expo-plugin-worklet-cleanup

Thank you for your interest in contributing! Here's how you can help.

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/AndyCross/expo-plugin-worklet-cleanup.git
   cd expo-plugin-worklet-cleanup
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

## Testing Locally

To test the plugin in an Expo project:

1. Build the plugin:
   ```bash
   npm run build
   ```

2. In your Expo project, add a local path reference:
   ```json
   {
     "plugins": ["../path/to/expo-plugin-worklet-cleanup"]
   }
   ```

3. Run prebuild:
   ```bash
   npx expo prebuild --clean
   ```

4. Check the generated `ios/YourApp/AppDelegate.swift` for the cleanup method.

## Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Ensure the build passes (`npm run build`)
5. Commit your changes (`git commit -m 'Add my feature'`)
6. Push to the branch (`git push origin feature/my-feature`)
7. Open a Pull Request

## Reporting Issues

When reporting issues, please include:

- Expo SDK version
- iOS version
- Crash log (if applicable)
- Steps to reproduce

## Code Style

- Use TypeScript
- Follow existing code patterns
- Add comments for complex logic

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
