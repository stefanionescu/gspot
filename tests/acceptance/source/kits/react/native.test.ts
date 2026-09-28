// React Native fixtures cover environment access, styling, and keyed lists. Additional cases check token storage, import boundaries, and text placement.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect, describe } from 'bun:test';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import { installSandbox } from '#tests/support/cli/sandbox.ts';
import { LIBRARIES_CLEAN } from '#tests/config/acceptance/source/kits/kits.ts';
import { REPORT, NATIVE_TSCONFIG, NATIVE_DEPENDENCIES } from '#tests/config/acceptance/source/kits/react.ts';

const LINT: { rule: string; path: string; text: string; line: number }[] = [
    {
        rule: 'expo/no-env-var-destructuring',
        path: 'src/address.ts',
        text: `// A planted file.\n\nconst { EXPO_PUBLIC_URL } = process.env;\n\n/** Where the service lives. */\nexport const address = EXPO_PUBLIC_URL;\n`,
        line: 3,
    },
    {
        rule: 'react-native/no-inline-styles',
        path: 'src/Box.tsx',
        text: `// A planted file.\n\n/**\n * Draws a box.\n * @returns the box\n */\nexport function Box(): unknown {\n    return <View style={{ padding: 8 }} />;\n}\n`,
        line: 8,
    },
    {
        rule: 'no-restricted-syntax',
        path: 'src/Rows.tsx',
        text: `// A planted file.\n\n/**\n * Lists rows.\n * @returns the list\n */\nexport function Rows(): unknown {\n    return <FlatList data={[]} renderItem={undefined} />;\n}\n`,
        line: 8,
    },
    {
        rule: 'no-restricted-syntax',
        path: 'src/session.ts',
        text: `// A planted file.\n\n/**\n * Keeps the session.\n * @param value the session\n * @returns when it is kept\n */\nexport async function keep(value: string): Promise<void> {\n    await AsyncStorage.setItem('auth_token', value);\n}\n`,
        line: 9,
    },
    {
        rule: '@react-native/no-deep-imports',
        path: 'src/frame.ts',
        text: `// A planted file.\n\nimport View from 'react-native/Libraries/Components/View/View';\n\n/** The view each screen draws in. */\nexport const Frame = View;\n`,
        line: 3,
    },
    {
        rule: 'react-native/no-raw-text',
        path: 'src/Label.tsx',
        text: `// A planted file.\n\n/**\n * Labels a row.\n * @returns the label\n */\nexport function Label(): unknown {\n    return <View>label</View>;\n}\n`,
        line: 8,
    },
];

describe('the react-native configuration', () => {
    test.each(LINT)(
        '$rule in $path fails and corrected source passes',
        async ({ rule, path, text, line }) => {
            await using sandbox = await testdir();
            const environment = await installSandbox(sandbox.path, {
                configurations: ['typescript', 'react-native'],
                dependencies: NATIVE_DEPENDENCIES,
                files: { 'tsconfig.json': NATIVE_TSCONFIG, 'src/answer.ts': LIBRARIES_CLEAN },
            });
            const clean = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            const outcome = await runPlanted(
                sandbox.path,
                { check: 'typescript/eslint', files: { [path]: text } },
                environment,
            );
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, REPORT)).json());
            expect(failed.checks).toMatchObject([{ check: 'typescript/eslint', status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(containing({ rule, file: path, line }));
            await Bun.write(join(sandbox.path, path), LIBRARIES_CLEAN);
            const correctedCheck = await run(
                sandbox.path,
                ['check', '--only', 'typescript/eslint', '--no-cache', '--json'],
                environment,
            );
            expect(correctedCheck.code, correctedCheck.stdout + correctedCheck.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(correctedCheck.stdout)).checks).toMatchObject([
                { check: 'typescript/eslint', status: 'ok', findings: [] },
            ]);
            const required = await run(
                sandbox.path,
                ['check', '--only', 'integrity/required-rules', '--no-cache'],
                environment,
            );
            expect(required.code, required.stdout + required.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 6,
    );
});
