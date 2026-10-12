/** The complete issue text of each failed SDK check, excluding Doctor's advice. */
const EXPECTED_ISSUES = [
    'Check that packages match versions required by installed Expo SDK The following packages should be updated for best compatibility with the installed expo version: react-native@0.81.4 - expected version: 0.81.5',
    'Check for app config fields that may not be synced in a non-CNG project This project contains native project folders but also has native configuration properties in app.json.',
] as const;

const FAILED_DOCTOR_REPORT = `Running 15 checks on your project...
[32m✔[39m Check package.json for common issues
[31m✖[39m Check that packages match versions required by installed Expo SDK
[33mThe following packages should be updated for best compatibility with the installed expo version:[39m
[33m  react-native@0.81.4 - expected version: 0.81.5[39m
[32mAdvice:[39m
[32mUse 'npx expo install --check' to review and upgrade your dependencies.[39m

✖ Check for app config fields that may not be synced in a non-CNG project
This project contains native project folders but also has native configuration properties in app.json.

13/15 checks passed. 2 checks failed. Possible issues detected:
Use the --verbose flag to see more details about passed checks.`;

/** The supported Doctor reports and an unstructured process failure. */
export const DOCTOR_RESULTS = [
    {
        name: 'failed SDK checks',
        expected: EXPECTED_ISSUES,
        result: { code: 1, missing: false, duration: 1, stdout: FAILED_DOCTOR_REPORT, stderr: '' },
    },
    {
        name: 'unstructured failure',
        result: { code: 1, missing: false, duration: 1, stdout: '', stderr: 'Unable to read Expo configuration' },
        expected: 'The expo-doctor command failed (exit 1): Unable to read Expo configuration',
    },
] as const;

/** Installed Doctor's version response at the subprocess boundary. */
export const DOCTOR_VERSION = { code: 0, missing: false, duration: 1, stdout: '1.20.4\n', stderr: '' } as const;

export const EXPO_DOCTOR_INSTALL = {
    '.gspot/node_modules/.bin/expo-doctor': '// The process boundary supplies the Doctor report.\n',
    '.gspot/node_modules/.bin/expo-doctor.cmd': '@echo off\r\n',
    '.gspot/node_modules/expo-doctor/package.json': '{"name":"expo-doctor","version":"1.20.4"}\n',
} as const;

export const EXPO_SCOPES_SETTINGS = `configurations = []
[[scope]]
path = "apps/first"
configurations = ["expo"]
[[scope]]
path = "apps/second"
configurations = ["expo"]
[rules]
enabled = false
`;
