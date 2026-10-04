export const REPORT =
    "Running 15 checks on your project...\n\u001B[32m✔\u001B[39m Check package.json for common issues\n\u001B[31m✖\u001B[39m Check that packages match versions required by installed Expo SDK\n\u001B[33mThe following packages should be updated for best compatibility with the installed expo version:\u001B[39m\n\u001B[33m  react-native@0.81.4 - expected version: 0.81.5\u001B[39m\n\u001B[32mAdvice:\u001B[39m\n\u001B[32mUse 'npx expo install --check' to review and upgrade your dependencies.\u001B[39m\n\n✖ Check for app config fields that may not be synced in a non-CNG project\nThis project contains native project folders but also has native configuration properties in app.json.\n\n13/15 checks passed. 2 checks failed. Possible issues detected:\nUse the --verbose flag to see more details about passed checks.";
/** The complete issue text of each failed SDK check, excluding Doctor's advice. */
export const EXPECTED_ISSUES = [
    'Check that packages match versions required by installed Expo SDK The following packages should be updated for best compatibility with the installed expo version: react-native@0.81.4 - expected version: 0.81.5',
    'Check for app config fields that may not be synced in a non-CNG project This project contains native project folders but also has native configuration properties in app.json.',
];
