import { reportSchema } from '#cli/execution/report.ts';
import { symlinkSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the react-native configuration: an environment variable taken apart, an inline style, a list with no key, a token in AsyncStorage, a deep import, text outside a text element, and an image the web accessibility rules would read.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const MODULES = join(import.meta.dir, '../../../../../node_modules');
const REPORT = '.gspot/reports/report.json';
const INIT = [
    'init',
    '--yes',
    '--configurations',
    'typescript',
    'react-native',
    '--without',
    'naming',
    'spelling',
    'css',
    'vitest',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const PACKAGE =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "expo": "54.0.0",\n        "react": "19.1.1",\n        "react-native": "0.81.4"\n    }\n}\n';
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

/**
 * Plants the React Native repository, installs its tools at the all level, and returns the command environment.
 * @param root the empty sandbox
 * @returns the PATH every gspot command of the test runs with
 */
async function installNative(root: string): Promise<Record<string, string>> {
    await createFileTree(root, {
        '.gitignore': 'node_modules\n',
        'package.json': PACKAGE,
        'tsconfig.json': TSCONFIG,
        'src/answer.ts': CLEAN,
    });
    symlinkSync(MODULES, join(root, 'node_modules'));
    commitAll(root);
    const environment = { PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}` };
    await install(root, INIT, environment);
    const selected = await run(root, ['set', 'level', 'all'], environment);
    if (selected.code !== 0) throw new Error(`The all level was not selected: ${selected.stdout}${selected.stderr}`);
    return environment;
}

describe('the react-native configuration', () => {
    test.each(LINT)(
        '$rule in $path fails and corrected source passes',
        async ({ rule, path, text, line }) => {
            await using sandbox = await testdir();
            const environment = await installNative(sandbox.path);
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
            expect(failed.checks[0]!.findings).toContainEqual(expect.objectContaining({ rule, file: path, line }));
            await Bun.write(join(sandbox.path, path), CLEAN);
            const corrected = await run(
                sandbox.path,
                ['check', '--only', 'typescript/eslint', '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
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

    test(
        'the jsx-a11y rules read no native view',
        async () => {
            await using sandbox = await testdir();
            const environment = await installNative(sandbox.path);
            const photo = head(
                '/**\n * Shows a photo.\n * @returns the photo\n */\nexport function Photo(): unknown {\n    return <img src="photo.png" />;\n}\n',
            );
            await runPlanted(
                sandbox.path,
                { check: 'typescript/eslint', files: { 'src/Photo.tsx': photo } },
                environment,
            );
            const report = reportSchema.parse(await Bun.file(join(sandbox.path, REPORT)).json());
            expect(
                report.checks
                    .flatMap(({ findings }) => findings)
                    .filter(({ rule }) => rule?.startsWith('jsx-a11y/') === true),
            ).toStrictEqual([]);
        },
        PLANTED_TIMEOUT_MS * 6,
    );
});
