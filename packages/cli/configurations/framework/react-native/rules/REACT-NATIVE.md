---
title: React Native
---

# React Native

These rules cover React Native and Expo apps: components, lists, styles, navigation, native data, and releases.
The React rules apply first. These add what a phone changes.

## Components and touch

- Give every touch target a size of at least 44 points on iOS or 48 dp on Android, with `hitSlop` where the drawing is smaller.
- Do not read `Dimensions` at module load. Use `useWindowDimensions`, which follows rotation and split view.
- Respect the safe area on every screen, through the safe area context.

## Lists

- Keep `renderItem` and the row component stable: define them outside the render, or memoize them.
- Give a list of fixed row height `getItemLayout`, so it scrolls to an index without measuring.

## Styles

- Build layouts that adapt to the available screen size and font scale.

### Style conventions

<!-- level: all -->

- Branch on `Platform.OS` in one place for one concern. A component full of platform checks is two components.

## Navigation and state

- Type the route parameters of every screen, and pass ids through them, not whole objects.
- A screen loads its own data from the id it receives.
- Do not keep server data in a global store by hand. Use a query cache that knows about refetching and staleness.
- Stop a subscription, a timer, and a listener when the screen loses focus or unmounts.

## Native data and secrets

- Nothing in the bundle is secret. A key that ships in the app belongs to everyone who downloads it.
- Ask for a permission at the moment the feature needs it, and handle the refusal.
- Validate a deep link before it navigates or acts. A link is input from outside.

## Performance

- Keep work off the JavaScript thread during a gesture or an animation. Run animations on the native driver or the UI thread.
- Size an image to the box it fills, and cache remote images.
- Do not log in a hot path, and strip console output from a release build.
- Tell the user to measure on a low-end Android device in a release build.

## Releases

- Version the native build and the JavaScript bundle together, and know which bundles a given native build accepts.
- An over-the-air update never changes native code or a permission.
- Tell the user to check the upgrade path from the last release with its stored data.
