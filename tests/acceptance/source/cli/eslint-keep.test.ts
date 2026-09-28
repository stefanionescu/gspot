import { test, expect } from 'bun:test';
import { join, relative } from 'node:path';
import { ESLint, loadESLint } from 'eslint';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import type { ApplyPreviewJson } from '#cli/types/commands/apply.ts';
import type { EslintAdoption } from '#tests/types/acceptance/source/cli.ts';
import { statSync, chmodSync, existsSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

import {
    ESLINT_CARRY_FILES,
    ESLINT_CARRY_CONFIG,
    ESLINT_CARRY_SOURCE,
} from '#tests/config/acceptance/source/cli/cli.ts';

async function expectAdoptedRules({ root, before }: EslintAdoption): Promise<void> {
    const expected = before.flatMap(({ filePath, messages }) =>
        messages
            .filter(({ ruleId }) => ruleId === 'eqeqeq')
            .map(({ severity, line, column }) => ({
                file: relative(root, filePath),
                severity,
                line,
                column,
            })),
    );
    expect(expected).toStrictEqual([
        { file: 'tests/[draft].js', severity: 2, line: 1, column: 41 },
        { file: 'tests/café note.js', severity: 2, line: 1, column: 41 },
        { file: 'server/source.js', severity: 1, line: 1, column: 41 },
    ]);
    const eslint = new ESLint({
        cwd: root,
        overrideConfigFile: join(root, '.gspot/config/eslint.config.mjs'),
    });
    const checked = await eslint.lintFiles(ESLINT_CARRY_FILES);
    expect(
        checked.flatMap(({ filePath, messages }) =>
            messages
                .filter(({ ruleId }) => ruleId === 'eqeqeq')
                .map(({ severity, line, column }) => ({
                    file: relative(root, filePath),
                    severity,
                    line,
                    column,
                })),
        ),
    ).toStrictEqual(expected);
    for (const file of ESLINT_CARRY_FILES) writeFileSync(join(root, file), ESLINT_CARRY_SOURCE.replace('==', '==='));
    const corrected = await eslint.lintFiles(ESLINT_CARRY_FILES);
    expect(corrected.flatMap(({ messages }) => messages.filter(({ ruleId }) => ruleId === 'eqeqeq'))).toStrictEqual([]);
    writeFileSync(join(root, 'tests/future.js'), ESLINT_CARRY_SOURCE);
    const [future] = await eslint.lintFiles(['tests/future.js']);
    expect(
        future!.messages
            .filter(({ ruleId }) => ruleId === 'eqeqeq')
            .map(({ ruleId, severity }) => ({ ruleId, severity })),
    ).toStrictEqual([{ ruleId: 'eqeqeq', severity: 2 }]);
}

async function expectRestoredConfiguration({ root, path, original }: EslintAdoption): Promise<void> {
    // The package manifest keeps its authored text; a native configuration file is rewritten or removed.
    const authored = join(root, path);
    const kept = existsSync(authored) && readFileSync(authored, 'utf8') === original;
    expect(kept).toBe(path === 'package.json');
    expect(existsSync(join(root, '.gspot/reports/report.json'))).toBe(false);
    const repeated = await run(root, ['apply', '--dry-run', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect((JSON.parse(repeated.stdout) as ApplyPreviewJson).drift).toStrictEqual([]);
    const removed = await run(root, ['uninstall', '--yes']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(readFileSync(join(root, path), 'utf8')).toBe(original);
    expect(statSync(join(root, path)).mode & 0o777).toBe(0o640);
}

test.each(
    ['eslint.config.mjs', '.eslintrc.json', 'package.json'].flatMap((path) => [
        { path, scenario: 'preserves effective rules and accepts corrected files', verify: expectAdoptedRules },
        { path, scenario: 'restores authored bytes and modes after uninstall', verify: expectRestoredConfiguration },
    ]),
)(
    'ESLint adoption from $path $scenario',
    async ({ path, verify }) => {
        await using repository = await testdir();
        const eslintrc = {
            root: true,
            parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
            rules: ESLINT_CARRY_CONFIG[0]!.rules,
            overrides: ESLINT_CARRY_CONFIG.slice(1),
        };
        const authored = path === 'package.json' ? { private: true, type: 'module', eslintConfig: eslintrc } : eslintrc;
        const original =
            path === 'eslint.config.mjs'
                ? `export default ${JSON.stringify(ESLINT_CARRY_CONFIG)};\n`
                : JSON.stringify(authored) + '\n';
        const eslintClass = await loadESLint({ useFlatConfig: path === 'eslint.config.mjs' });
        await createFileTree(repository.path, {
            'package.json': '{"private":true,"type":"module"}\n',
            [path]: original,
            ...Object.fromEntries(ESLINT_CARRY_FILES.map((file) => [file, ESLINT_CARRY_SOURCE])),
        });
        chmodSync(join(repository.path, path), 0o640);
        symlinkSync(join(import.meta.dir, '../../../../node_modules'), join(repository.path, 'node_modules'));
        const before = await new eslintClass({ cwd: repository.path }).lintFiles(ESLINT_CARRY_FILES);
        const result = await run(repository.path, [
            'init',
            '--yes',
            '--json',
            '--kits',
            'javascript',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-guides',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect((JSON.parse(result.stdout) as InitJson).plan!.remove.some((entry) => entry.path === path)).toBe(
            path !== 'package.json',
        );
        await verify({ root: repository.path, path, original, before });
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'init retains unevaluated ESLint configuration with an explanation when its implementation is absent',
    async () => {
        await using repository = await testdir();
        const original = 'export default [{ rules: { eqeqeq: "error" } }];\n';
        await createFileTree(repository.path, { 'eslint.config.mjs': original, 'source.js': ESLINT_CARRY_SOURCE });
        const result = await run(repository.path, [
            'init',
            '--yes',
            '--json',
            '--kits',
            'javascript',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-guides',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        // The runtime words the missing dependency its own way; the note names the package either way.
        expect((JSON.parse(result.stdout) as InitJson).plan!.unread[0]!.note).toMatch(
            /Cannot find (?:package|module) 'eslint'/u,
        );
        expect(existsSync(join(repository.path, 'gspot.toml'))).toBe(false);
        expect(readFileSync(join(repository.path, 'eslint.config.mjs'), 'utf8')).toBe(original);
        expect(readFileSync(join(repository.path, 'source.js'), 'utf8')).toBe(ESLINT_CARRY_SOURCE);
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
            'source.js': ESLINT_CARRY_SOURCE,
        });
        symlinkSync(join(import.meta.dir, '../../../../node_modules'), join(repository.path, 'node_modules'));
        const result = await run(repository.path, [
            'init',
            '--yes',
            '--json',
            '--kits',
            'javascript',
            'formatting',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-guides',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(result.stdout + result.stderr).toContain('changed after replace was planned');
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
        await createFileTree(repository.path, { 'eslint.config.mjs': original, 'source.js': ESLINT_CARRY_SOURCE });
        symlinkSync(join(import.meta.dir, '../../../../node_modules'), join(repository.path, 'node_modules'));
        const args = [
            'init',
            '--yes',
            '--json',
            '--kits',
            'javascript',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-guides',
            '--no-install',
        ];
        const invalid = await run(repository.path, args);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
        expect(() => {
            JSON.parse(invalid.stdout);
        }).not.toThrow();
        expect(invalid.stdout).not.toContain('authored linter log');
        expect(invalid.stdout + invalid.stderr).toContain('eqeqeq');
        expect(existsSync(join(repository.path, 'gspot.toml'))).toBe(false);
        expect(readFileSync(join(repository.path, 'eslint.config.mjs'), 'utf8')).toBe(original);
        const corrected = original.replace('"invalid"', '"warn"');
        writeFileSync(join(repository.path, 'eslint.config.mjs'), corrected);
        const accepted = await run(repository.path, args);
        expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
        expect(() => {
            JSON.parse(accepted.stdout);
        }).not.toThrow();
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
        await createFileTree(repository.path, { 'eslint.config.mjs': original, 'source.js': ESLINT_CARRY_SOURCE });
        symlinkSync(join(import.meta.dir, '../../../../node_modules'), join(repository.path, 'node_modules'));
        const result = await run(repository.path, [
            'init',
            '--yes',
            '--json',
            '--kits',
            'javascript',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-guides',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect((JSON.parse(result.stdout) as InitJson).plan!.unread[0]!.note).toContain(
            'processor has no imported module owner',
        );
        expect(existsSync(join(repository.path, 'gspot.toml'))).toBe(false);
        const eslint = new ESLint({ cwd: repository.path });
        const [defective] = await eslint.lintFiles(['source.js']);
        expect(defective!.messages.map(({ ruleId, line, column }) => ({ ruleId, line, column }))).toStrictEqual([
            { ruleId: 'eqeqeq', line: 1, column: 41 },
        ]);
        writeFileSync(join(repository.path, 'source.js'), ESLINT_CARRY_SOURCE.replace('==', '==='));
        const [corrected] = await eslint.lintFiles(['source.js']);
        expect(corrected!.messages).toStrictEqual([]);
        expect(readFileSync(join(repository.path, 'eslint.config.mjs'), 'utf8')).toBe(original);
    },
    PLANTED_TIMEOUT_MS,
);
