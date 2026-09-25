import { reportSchema } from '#cli/execution/report.ts';
import { symlinkSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the react-native configuration: an environment variable taken apart, an inline style, a list with no key, and a token in AsyncStorage.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const MODULES = join(import.meta.dir, '../../../../../node_modules');
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

const LINT: [string, string, string][] = [
    [
        'expo/no-env-var-destructuring',
        'src/address.ts',
        head(
            'const { EXPO_PUBLIC_URL } = process.env;\n\n/** Where the service lives. */\nexport const address = EXPO_PUBLIC_URL;\n',
        ),
    ],
    [
        'An inline style is a new object on every render',
        'src/Box.tsx',
        head(
            '/**\n * Draws a box.\n * @returns the box\n */\nexport function Box(): unknown {\n    return <View style={{ padding: 8 }} />;\n}\n',
        ),
    ],
    [
        'Give the list a keyExtractor',
        'src/Rows.tsx',
        head(
            '/**\n * Lists rows.\n * @returns the list\n */\nexport function Rows(): unknown {\n    return <FlatList data={[]} renderItem={undefined} />;\n}\n',
        ),
    ],
    [
        'AsyncStorage is plain text on the device',
        'src/session.ts',
        head(
            "/**\n * Keeps the session.\n * @param value the session\n * @returns when it is kept\n */\nexport async function keep(value: string): Promise<void> {\n    await AsyncStorage.setItem('auth_token', value);\n}\n",
        ),
    ],
];

describe('the react-native configuration', () => {
    test.each(LINT.map(([expected, path, text], index) => ({ expected, path, text, line: [3, 8, 8, 9][index]! })))(
        '$expected in $path fails and corrected source passes',
        async ({ expected, path, text, line }) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                '.gitignore': 'node_modules\n',
                'package.json': PACKAGE,
                'tsconfig.json': TSCONFIG,
                'src/answer.ts': CLEAN,
            });
            symlinkSync(MODULES, join(sandbox.path, 'node_modules'));
            commitAll(sandbox.path);
            const environment = {
                PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
            };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const clean = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            const outcome = await runPlanted(
                sandbox.path,
                { check: 'typescript/eslint', files: { [path]: text } },
                environment,
            );
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: 'typescript/eslint', status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(
                expect.objectContaining({
                    rule: expected.startsWith('expo/') ? expected : 'no-restricted-syntax',
                    file: path,
                    line,
                }),
            );
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
});
