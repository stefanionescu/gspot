import { join, relative } from 'node:path';
import { chmodSync, existsSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { ESLint, loadESLint } from 'eslint';
import { createFileTree, testdir } from 'testdirs';
import { run, PLANTED_TIMEOUT_MS } from '#tests/harness/planted.ts';

const SOURCE = 'export const isEmpty = (value) => value == null;\n';
const FILES = ['source.js', 'tests/[draft].js', 'tests/café note.js', 'server/source.js', 'components/source.js'];
const CONFIG = [
    { files: ['**/*.js'], rules: { eqeqeq: ['error', 'smart'] } },
    { files: ['tests/**'], rules: { eqeqeq: ['error', 'always'] } },
    { files: ['server/**'], rules: { eqeqeq: ['warn', 'always'] } },
    { files: ['components/**'], rules: { eqeqeq: 'off' } },
];

test.each(['eslint.config.mjs', '.eslintrc.json', 'package.json'])(
    'init carries resolved ESLint core and disabled rules from %s for every governed path',
    async (path) => {
        await using repository = await testdir();
        const legacy = {
            root: true,
            parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
            rules: CONFIG[0]!.rules,
            overrides: CONFIG.slice(1),
        };
        const original =
            path === 'eslint.config.mjs'
                ? `export default ${JSON.stringify(CONFIG)};\n`
                : JSON.stringify(
                      path === 'package.json' ? { private: true, type: 'module', eslintConfig: legacy } : legacy,
                  ) + '\n';
        const Constructor = await loadESLint({ useFlatConfig: path === 'eslint.config.mjs' });
        await createFileTree(repository.path, {
            'package.json': '{"private":true,"type":"module"}\n',
            [path]: original,
            ...Object.fromEntries(FILES.map((file) => [file, SOURCE])),
        });
        chmodSync(join(repository.path, path), 0o640);
        symlinkSync(join(import.meta.dir, '../../../node_modules'), join(repository.path, 'node_modules'));
        const before = await new Constructor({ cwd: repository.path }).lintFiles(FILES);
        const expected = before.flatMap(({ filePath, messages }) =>
            messages
                .filter(({ ruleId }) => ruleId === 'eqeqeq')
                .map(({ severity, line, column }) => ({
                    file: relative(repository.path, filePath),
                    severity,
                    line,
                    column,
                })),
        );
        expect(expected).toEqual([
            { file: 'tests/[draft].js', severity: 2, line: 1, column: 41 },
            { file: 'tests/café note.js', severity: 2, line: 1, column: 41 },
            { file: 'server/source.js', severity: 1, line: 1, column: 41 },
        ]);
        const result = await run(repository.path, [
            'init',
            '--yes',
            '--json',
            '--presets',
            'javascript',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        if (path !== 'eslint.config.mjs') {
            expect(result.code, result.stdout + result.stderr).toBe(2);
            expect(result.stdout).toContain('flat configuration');
            expect(readFileSync(join(repository.path, path), 'utf8')).toBe(original);
            expect(existsSync(join(repository.path, 'gspot.toml'))).toBe(false);
            return;
        }
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(JSON.parse(result.stdout).plan.remove.some((entry: { path: string }) => entry.path === path)).toBe(true);
        const eslint = new ESLint({
            cwd: repository.path,
            overrideConfigFile: join(repository.path, '.gspot/eslint.config.mjs'),
        });
        const checked = await eslint.lintFiles(FILES);
        expect(
            checked.flatMap(({ filePath, messages }) =>
                messages
                    .filter(({ ruleId }) => ruleId === 'eqeqeq')
                    .map(({ severity, line, column }) => ({
                        file: relative(repository.path, filePath),
                        severity,
                        line,
                        column,
                    })),
            ),
        ).toEqual(expected);
        for (const file of FILES) writeFileSync(join(repository.path, file), SOURCE.replace('==', '==='));
        const corrected = await eslint.lintFiles(FILES);
        expect(corrected.flatMap(({ messages }) => messages.filter(({ ruleId }) => ruleId === 'eqeqeq'))).toEqual([]);
        writeFileSync(join(repository.path, 'tests/future.js'), SOURCE);
        const [future] = await eslint.lintFiles(['tests/future.js']);
        expect(
            future!.messages
                .filter(({ ruleId }) => ruleId === 'eqeqeq')
                .map(({ ruleId, severity }) => ({ ruleId, severity })),
        ).toEqual([{ ruleId: 'eqeqeq', severity: 2 }]);
        expect(readFileSync(join(repository.path, path), 'utf8')).not.toBe(original);
        expect(existsSync(join(repository.path, '.gspot/report.json'))).toBe(false);
        const repeated = await run(repository.path, ['apply', '--dry-run', '--json']);
        expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
        expect(JSON.parse(repeated.stdout).drift).toEqual([]);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'init retains unevaluated ESLint configuration with an explanation when its implementation is absent',
    async () => {
        await using repository = await testdir();
        const original = 'export default [{ rules: { eqeqeq: "error" } }];\n';
        await createFileTree(repository.path, { 'eslint.config.mjs': original, 'source.js': SOURCE });
        const result = await run(repository.path, [
            'init',
            '--yes',
            '--json',
            '--presets',
            'javascript',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(JSON.parse(result.stdout).plan.unread[0].note).toContain("Cannot find package 'eslint'");
        expect(existsSync(join(repository.path, 'gspot.toml'))).toBe(false);
        expect(readFileSync(join(repository.path, 'eslint.config.mjs'), 'utf8')).toBe(original);
        expect(readFileSync(join(repository.path, 'source.js'), 'utf8')).toBe(SOURCE);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'init preserves an ESLint input changed by formatter evaluation before policy publication',
    async () => {
        await using repository = await testdir();
        const replacement = 'export default [{ rules: { eqeqeq: "off" } }];\n';
        const formatter = `import { writeFileSync } from 'node:fs'; writeFileSync(new URL('./eslint.config.mjs', import.meta.url), ${JSON.stringify(replacement)}); export default { semi: false };\n`;
        await createFileTree(repository.path, {
            'prettier.config.mjs': formatter,
            'eslint.config.mjs': 'export default [{ rules: { eqeqeq: "error" } }];\n',
            'source.js': SOURCE,
        });
        symlinkSync(join(import.meta.dir, '../../../node_modules'), join(repository.path, 'node_modules'));
        const result = await run(repository.path, [
            'init',
            '--yes',
            '--json',
            '--presets',
            'javascript',
            'formatting',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(result.stdout + result.stderr).toContain('changed after takeover was planned');
        expect(existsSync(join(repository.path, 'gspot.toml'))).toBe(false);
        expect(readFileSync(join(repository.path, 'eslint.config.mjs'), 'utf8')).toBe(replacement);
        expect(readFileSync(join(repository.path, 'prettier.config.mjs'), 'utf8')).toBe(formatter);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'invalid executable ESLint configuration preserves JSON and accepts corrected input',
    async () => {
        await using repository = await testdir();
        const original = 'console.log("authored linter log"); export default [{ rules: { eqeqeq: "invalid" } }];\n';
        await createFileTree(repository.path, { 'eslint.config.mjs': original, 'source.js': SOURCE });
        symlinkSync(join(import.meta.dir, '../../../node_modules'), join(repository.path, 'node_modules'));
        const args = [
            'init',
            '--yes',
            '--json',
            '--presets',
            'javascript',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ];
        const invalid = await run(repository.path, args);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
        expect(() => JSON.parse(invalid.stdout)).not.toThrow();
        expect(invalid.stdout).not.toContain('authored linter log');
        expect(invalid.stdout + invalid.stderr).toContain('eqeqeq');
        expect(existsSync(join(repository.path, 'gspot.toml'))).toBe(false);
        expect(readFileSync(join(repository.path, 'eslint.config.mjs'), 'utf8')).toBe(original);
        const corrected = original.replace('"invalid"', '"warn"');
        writeFileSync(join(repository.path, 'eslint.config.mjs'), corrected);
        const accepted = await run(repository.path, args);
        expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
        expect(() => JSON.parse(accepted.stdout)).not.toThrow();
        expect(accepted.stdout).not.toContain('authored linter log');
        expect(readFileSync(join(repository.path, 'eslint.config.mjs'), 'utf8')).not.toBe(corrected);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'unsupported ESLint processors refuse adoption and leave native behavior intact',
    async () => {
        await using repository = await testdir();
        const original =
            'export default [{ files: ["**/*.js"], processor: { preprocess(text) { return [text]; }, postprocess(messages) { return messages.flat(); } }, rules: { eqeqeq: "error" } }];\n';
        await createFileTree(repository.path, { 'eslint.config.mjs': original, 'source.js': SOURCE });
        symlinkSync(join(import.meta.dir, '../../../node_modules'), join(repository.path, 'node_modules'));
        const result = await run(repository.path, [
            'init',
            '--yes',
            '--json',
            '--presets',
            'javascript',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(JSON.parse(result.stdout).plan.unread[0].note).toContain('processor conversion is unsupported');
        expect(existsSync(join(repository.path, 'gspot.toml'))).toBe(false);
        const eslint = new ESLint({ cwd: repository.path });
        const [defective] = await eslint.lintFiles(['source.js']);
        expect(defective!.messages.map(({ ruleId, line, column }) => ({ ruleId, line, column }))).toEqual([
            { ruleId: 'eqeqeq', line: 1, column: 41 },
        ]);
        writeFileSync(join(repository.path, 'source.js'), SOURCE.replace('==', '==='));
        const [corrected] = await eslint.lintFiles(['source.js']);
        expect(corrected!.messages).toEqual([]);
        expect(readFileSync(join(repository.path, 'eslint.config.mjs'), 'utf8')).toBe(original);
    },
    PLANTED_TIMEOUT_MS,
);
