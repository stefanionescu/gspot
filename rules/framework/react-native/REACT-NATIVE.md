---
layer: framework
preset: react-native
title: React Native
---

# React Native

These rules cover React Native and Expo apps: components, lists, styles, navigation, native data, and releases.
The React rules apply first. These add what a phone changes.

## Components and touch

- Use `Pressable` for touch. The `Touchable` components are kept for old code and get no new behavior.
- Give every touch target a size of 44 points or more, with `hitSlop` where the drawing is smaller.
- Every touch target carries `accessibilityRole` and a label a screen reader can speak.
- Wrap text in `Text`. A bare string inside a `View` crashes on a device.
- Do not read `Dimensions` at module load. Use `useWindowDimensions`, which follows rotation and split view.
- Respect the safe area on every screen, through the safe area context.

## Lists

- Render a list that grows through `FlatList` or `SectionList`, never through `map` inside a `ScrollView`.
- Every list has a `keyExtractor` that returns a stable id. An index is not a key for a list that changes.
- Keep `renderItem` and the row component stable: define them outside the render, or memoize them.
- Give a list of fixed row height `getItemLayout`, so it scrolls to an index without measuring.

## Styles

- Name styles in `StyleSheet.create` below the component. Do not write an object in a `style` prop.
- Read colors, spacing, and type sizes from one theme module. Do not write a color literal in a component.
- Build layout with flexbox. Do not position with absolute numbers measured on one phone.
- Branch on `Platform.OS` in one place for one concern. A component full of platform checks is two components.

## Navigation and state

- Type the route parameters of every screen, and pass ids through them, not whole objects.
- A screen loads its own data from the id it receives.
- Do not keep server data in a global store by hand. Use a query cache that knows about refetching and staleness.
- Stop a subscription, a timer, and a listener when the screen loses focus or unmounts.

## Native data and secrets

- `AsyncStorage` is plain text on the device. Keep a token, a password, and a key in the secure store of the platform.
- Nothing in the bundle is secret. A key that ships in the app belongs to everyone who downloads it.
- Write `process.env.EXPO_PUBLIC_NAME` out in full. The bundler replaces that exact text, so destructuring and a computed key read nothing.
- Ask for a permission at the moment the feature needs it, and handle the refusal.
- Validate a deep link before it navigates or acts. A link is input from outside.

## Performance

- Keep work off the JavaScript thread during a gesture or an animation. Run animations on the native driver or the UI thread.
- Size an image to the box it fills, and cache remote images.
- Do not log in a hot path, and strip console output from a release build.
- Measure on a low-end Android device in a release build. A simulator in debug mode says nothing about speed.

## Releases

- Version the native build and the JavaScript bundle together, and know which bundles a given native build accepts.
- An over-the-air update never changes native code or a permission.
- Test the upgrade path from the last release, with its stored data, before shipping.
