import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

export const DOCTOR_FINDING_MESSAGES = [
    'Check that packages match versions required by installed Expo SDK The following packages should be updated for best compatibility with the installed expo version: react-native@0.81.4 - expected version: 0.81.5',
    'Check for app config fields that may not be synced in a non-CNG project This project contains native project folders but also has native configuration properties in app.json.',
] as const;

const FAILED_DOCTOR_REPORT = `Running 15 checks on your project...
\u001B[32m✔\u001B[39m Check package.json for common issues
\u001B[31m✖\u001B[39m Check that packages match versions required by installed Expo SDK
\u001B[33mThe following packages should be updated for best compatibility with the installed expo version:\u001B[39m
\u001B[33m  react-native@0.81.4 - expected version: 0.81.5\u001B[39m
\u001B[32mAdvice:\u001B[39m
\u001B[32mUse 'npx expo install --check' to review and upgrade your dependencies.\u001B[39m

✖ Check for app config fields that may not be synced in a non-CNG project
This project contains native project folders but also has native configuration properties in app.json.

13/15 checks passed. 2 checks failed. Possible issues detected:
Use the --verbose flag to see more details about passed checks.`;

export const FAILED_DOCTOR_RUN = { code: 1, stdout: FAILED_DOCTOR_REPORT } as const;

export const UNSTRUCTURED_DOCTOR_RUN = { code: 1, stderr: 'Unable to read Expo configuration' } as const;

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
