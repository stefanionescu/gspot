import { symlinkSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
// Planted repository for the react-native preset: an environment variable taken apart, an inline style, a list with no key, and a token in AsyncStorage.
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--presets',
    'typescript,react-native',
    '--without',
    'naming,spelling,css,vitest',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const PACKAGE =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "expo": "54.0.0",\n        "react": "19.1.1",\n        "react-native": "0.81.4"\n    }\n}\n';
const TSCONFIG =
    '{\n    "extends": "./.gspot/tsconfig.base.json",\n    "compilerOptions": { "jsx": "react-jsx", "module": "ESNext", "moduleResolution": "Bundler" },\n    "include": ["src"]\n}\n';
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

describe('the react-native preset', () => {
    test(
        'the Expo rules and the React Native selectors fire on their planted files',
        async () => {
            await using fixture = await createFixture({
                '.gitignore': 'node_modules\n',
                'package.json': PACKAGE,
                'tsconfig.json': TSCONFIG,
                'src/answer.ts': CLEAN,
            });
            symlinkSync(MODULES, join(fixture.path, 'node_modules'));
            commitAll(fixture.path);
            const environment = {
                PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
            };
            await install(fixture.path, INIT, environment);
            const policy = await Bun.file(join(fixture.path, 'gspot.toml')).text();
            expect(policy).toContain('react-native');
            const clean = run(fixture.path, ['check', 'typescript/eslint', '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            for (const [expected, path, text] of LINT) {
                const outcome = await runPlanted(
                    fixture.path,
                    { id: 'typescript/eslint', files: { [path]: text }, expected },
                    environment,
                );
                expect(outcome.stdout, `${expected}: ${outcome.stdout}${outcome.stderr}`).toContain(expected);
            }
            const required = run(fixture.path, ['check', 'integrity/required-rules', '--no-cache'], environment);
            expect(required.code, required.stdout + required.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 6,
    );
});
