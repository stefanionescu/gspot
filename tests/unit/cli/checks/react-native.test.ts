import { describe, expect, test } from 'bun:test';
import { doctorFindings } from '#cli/checks/react-native.ts';

const REPORT = [
    'Running 15 checks on your project...',
    '\u001B[32m✔\u001B[39m Check package.json for common issues',
    '\u001B[31m✖\u001B[39m Check that packages match versions required by installed Expo SDK',
    '\u001B[33mThe following packages should be updated for best compatibility with the installed expo version:\u001B[39m',
    '\u001B[33m  react-native@0.81.4 - expected version: 0.81.5\u001B[39m',
    '\u001B[32mAdvice:\u001B[39m',
    "\u001B[32mUse 'npx expo install --check' to review and upgrade your dependencies.\u001B[39m",
    '',
    '✖ Check for app config fields that may not be synced in a non-CNG project',
    'This project contains native project folders but also has native configuration properties in app.json.',
    '',
    '13/15 checks passed. 2 checks failed. Possible issues detected:',
    'Use the --verbose flag to see more details about passed checks.',
].join('\n');

describe('doctorFindings', () => {
    test('each failed check is one finding on the project manifest with its issues and without its advice', () => {
        expect(doctorFindings('react-native/expo-doctor', 'apps/mobile/package.json', REPORT)).toStrictEqual([
            {
                check: 'react-native/expo-doctor',
                file: 'apps/mobile/package.json',
                line: 1,
                rule: 'expo-doctor',
                message:
                    'Check that packages match versions required by installed Expo SDK The following packages should be updated for best compatibility with the installed expo version: react-native@0.81.4 - expected version: 0.81.5',
                fixable: false,
            },
            {
                check: 'react-native/expo-doctor',
                file: 'apps/mobile/package.json',
                line: 1,
                rule: 'expo-doctor',
                message:
                    'Check for app config fields that may not be synced in a non-CNG project This project contains native project folders but also has native configuration properties in app.json.',
                fixable: false,
            },
        ]);
    });

    test('a passing report yields nothing', () => {
        expect(
            doctorFindings(
                'react-native/expo-doctor',
                'package.json',
                '✔ Check package.json\n15/15 checks passed. No issues detected!\n',
            ),
        ).toStrictEqual([]);
    });
});
