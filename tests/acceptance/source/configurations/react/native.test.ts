import { join } from 'node:path';
import { testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { reportSchema } from '#cli/execution/report.ts';
import { containing } from '#tests/support/expectations.ts';
import { installSandbox } from '#tests/support/cli/sandbox.ts';
// Planted repository for the react-native configuration: an environment variable taken apart, an inline style, a list with no key, a token in AsyncStorage, a deep import, and text outside a text element.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { expectCorrected, runPlanted } from '#tests/support/cli/planted.ts';

const REPORT = '.gspot/reports/report.json';
const DEPENDENCIES = { expo: '54.0.0', react: '19.1.1', 'react-native': '0.81.4' };
const TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "ESNext",\n        "moduleResolution": "Bundler",\n        "types": [],\n        "skipLibCheck": true,\n        "jsx": "react-jsx"\n    },\n    "include": ["src"]\n}\n';
const CLEAN = '// A value the planted files build on.\n\n/** The answer. */\nexport const answer = 42;\n';
const head = (text: string): string => `// A planted file.\n\n${text}`;

const LINT: { rule: string; path: string; text: string; line: number }[] = [
    {
        rule: 'expo/no-env-var-destructuring',
        path: 'src/address.ts',
        text: head(
            'const { EXPO_PUBLIC_URL } = process.env;\n\n/** Where the service lives. */\nexport const address = EXPO_PUBLIC_URL;\n',
        ),
        line: 3,
    },
    {
        rule: 'react-native/no-inline-styles',
        path: 'src/Box.tsx',
        text: head(
            '/**\n * Draws a box.\n * @returns the box\n */\nexport function Box(): unknown {\n    return <View style={{ padding: 8 }} />;\n}\n',
        ),
        line: 8,
    },
    {
        rule: 'no-restricted-syntax',
        path: 'src/Rows.tsx',
        text: head(
            '/**\n * Lists rows.\n * @returns the list\n */\nexport function Rows(): unknown {\n    return <FlatList data={[]} renderItem={undefined} />;\n}\n',
        ),
        line: 8,
    },
    {
        rule: 'no-restricted-syntax',
        path: 'src/session.ts',
        text: head(
            "/**\n * Keeps the session.\n * @param value the session\n * @returns when it is kept\n */\nexport async function keep(value: string): Promise<void> {\n    await AsyncStorage.setItem('auth_token', value);\n}\n",
        ),
        line: 9,
    },
    {
        rule: '@react-native/no-deep-imports',
        path: 'src/frame.ts',
        text: head(
            "import View from 'react-native/Libraries/Components/View/View';\n\n/** The view each screen draws in. */\nexport const Frame = View;\n",
        ),
        line: 3,
    },
    {
        rule: 'react-native/no-raw-text',
        path: 'src/Label.tsx',
        text: head(
            '/**\n * Labels a row.\n * @returns the label\n */\nexport function Label(): unknown {\n    return <View>label</View>;\n}\n',
        ),
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
                dependencies: DEPENDENCIES,
                files: { 'tsconfig.json': TSCONFIG, 'src/answer.ts': CLEAN },
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
            await Bun.write(join(sandbox.path, path), CLEAN);
            await expectCorrected(sandbox.path, 'typescript/eslint', environment);
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
