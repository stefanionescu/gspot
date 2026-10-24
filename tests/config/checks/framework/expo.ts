import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

export const FAILED_DOCTOR_REPORT = `Running 15 checks on your project...
\u{1B}[32m✔\u{1B}[39m Check package.json for common issues
\u{1B}[31m✖\u{1B}[39m Check that packages match versions required by installed Expo SDK
\u{1B}[33mThe following packages should be updated for best compatibility with the installed expo version:\u{1B}[39m
\u{1B}[33m  react-native@0.81.4 - expected version: 0.81.5\u{1B}[39m
\u{1B}[32mAdvice:\u{1B}[39m
\u{1B}[32mUse 'npx expo install --check' to review and upgrade your dependencies.\u{1B}[39m

✖ Check for app config fields that may not be synced in a non-CNG project
This project contains native project folders but also has native configuration properties in app.json.

13/15 checks passed. 2 checks failed. Possible issues detected:
Use the --verbose flag to see more details about passed checks.`;

export const EXPO_DOCTOR_INSTALL = {
    [`${GSPOT_PATHS.nodeModules}/.bin/expo-doctor`]: '// The process boundary supplies the Doctor report.\n',
    [`${GSPOT_PATHS.nodeModules}/.bin/expo-doctor.cmd`]: '@echo off\r\n',
} as const;

export const APP_FOLDERS = ['apps/first', 'apps/second'] as const;

export const EXPO_SCOPE_SETTINGS = buildSandboxSettings([], {
    scopes: APP_FOLDERS.map((path) => ({ path, configurations: ['expo'] })),
});

export const EXPO_PACKAGE_JSON = '{"private":true,"dependencies":{"expo":"54.0.0"}}\n';

export const INSTALLED_EXPO_PACKAGE_JSON = '{"name":"expo","version":"54.0.0"}\n';
