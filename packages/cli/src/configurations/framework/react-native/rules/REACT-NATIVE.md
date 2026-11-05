# React Native

Read this rule when you change a React Native or Expo app.

Read `REACT.md` beside this file first.

## Components

- Respect the safe area on every screen, through the safe area context.

## Lists

- Keep `renderItem` and the row component stable: define them outside the render, or memoize them.
- Give a list of fixed row height `getItemLayout`, so it scrolls to an index without measuring.

## Styles

- Build layouts that adapt to the available screen size and font scale.

### Style conventions

<!-- level: all -->

- Branch on `Platform.OS` in one place for one concern. Split a component full of platform checks into two.

## Navigation and state

- Type the route parameters of every screen, and pass ids through them, not whole objects.
- A screen loads its own data from the id it receives.
- Stop a subscription, a timer, and a listener when the screen loses focus or unmounts.

## Native data and secrets

- The bundle holds no secret.
- Keep a token, a password, or another secret in the secure store of the platform, never in `AsyncStorage`.
- Ask for a permission at the moment the feature needs it, and handle the refusal.
- Validate a deep link before it navigates or acts. A link supplies input from outside.

## Performance

- Keep work off the JavaScript thread during a gesture or an animation. Run animations on the native driver or the UI
  thread.
- Size an image to the box it fills, and cache remote images.
- Do not log in a hot path, and strip console output from a release build.
- Tell the user to measure on a low-end Android device in a release build.

## Releases

- Version the app binary and the JavaScript bundle together, and track which bundles each build accepts.
- An over-the-air update never changes native code or a permission.
- Tell the user to check the upgrade path from the last release with its stored data.
