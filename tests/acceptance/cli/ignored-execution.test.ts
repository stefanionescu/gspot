import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { parseProfile } from '#cli/profile/read.ts';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/output/schema.ts';
import { exportedProfile } from '#cli/profile/export.ts';
import { existsSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';

test('a global ignore stops a repository check and its correction command until removed', async () => {
    await using directory = await testdir();
    const command = ['bash', '-c', 'printf executed > observed.txt; exit 1'];
    const fix = ['bash', '-c', 'printf corrected > corrected.txt'];
    const policy = `version = 1\nconfigurations = []\n[rules]\ninstall = false\n[[check]]\nname = "project/quality"\ncommand = ${JSON.stringify(command)}\nfix_command = ${JSON.stringify(fix)}\nfix_order = "codemod"\npaths = ["entry.sh"]\nstage = "commit"\n`;
    await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'echo example\n' });
    const args = ['check', '--only', 'project/quality', '--no-cache', '--json'];
    const before = await run(directory.path, args);
    expect(before.code, before.stdout + before.stderr).toBe(1);
    expect(readFileSync(join(directory.path, 'observed.txt'), 'utf8')).toBe('executed');
    unlinkSync(join(directory.path, 'observed.txt'));
    const ignored = await run(directory.path, ['ignore', 'project/quality']);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const skipped = await run(directory.path, [...args, '--fix']);
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
    const report = reportSchema.parse(JSON.parse(skipped.stdout));
    expect(report.checks[0]).toMatchObject({ check: 'project/quality', status: 'skipped', findings: [] });
    expect(report.skips).toStrictEqual([{ check: 'project/quality', source: 'ignore' }]);
    expect(report.coverage.checked).toBe(0);
    expect(report.ignores).toStrictEqual([{ check: 'project/quality', matched: 0 }]);
    expect(existsSync(join(directory.path, 'observed.txt'))).toBe(false);
    expect(existsSync(join(directory.path, 'corrected.txt'))).toBe(false);
    const removed = await run(directory.path, ['ignore', 'project/quality', '--remove']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = await run(directory.path, args);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(readFileSync(join(directory.path, 'observed.txt'), 'utf8')).toBe('executed');
});

test('generated ESLint applies explicit ignores after enabled rule settings', async () => {
    await using directory = await testdir();
    const modules = join(import.meta.dir, '../../../node_modules');
    const policy =
        'version = 1\nconfigurations = ["javascript"]\n[rules]\ninstall = false\n[tools.eslint.rules]\n"no-console" = "error"\n';
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': 'console.log("example");\n',
    });
    symlinkSync(modules, join(directory.path, 'node_modules'));
    for (const ignored of [false, true, false]) {
        writeFileSync(
            join(directory.path, 'gspot.toml'),
            policy + (ignored ? '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "no-console"\n' : ''),
        );
        const applied = await run(directory.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const lint = Bun.spawnSync(
            [
                join(modules, '.bin/eslint'),
                '--config',
                '.gspot/config/eslint.config.mjs',
                '--format',
                'json',
                'source.js',
            ],
            { cwd: directory.path },
        );
        expect(lint.exitCode, lint.stderr.toString()).not.toBe(2);
        const findings = JSON.parse(lint.stdout.toString()) as {
            messages: { ruleId: string; line: number; column: number }[];
        }[];
        expect(
            findings
                .flatMap(({ messages }) => messages)
                .filter(({ ruleId }) => ruleId === 'no-console')
                .map(({ ruleId, line, column }) => ({ ruleId, line, column })),
        ).toStrictEqual(ignored ? [] : [{ ruleId: 'no-console', line: 1, column: 1 }]);
    }
});

test('ESLint overrides preserve order, nested scope bounds, future files, and path-specific ignores', async () => {
    await using directory = await testdir();
    const modules = join(import.meta.dir, '../../../node_modules');
    const policy = `version = 1
configurations = ["javascript"]
[rules]
install = false
[tools.eslint.rules]
eqeqeq = ["error", "smart"]
[[tools.eslint.overrides]]
paths = ["tests"]
rules = {eqeqeq = ["error", "always"]}
[[tools.eslint.overrides]]
paths = ["tests/exempt.js"]
rules = {eqeqeq = ["error", "smart"]}
[[scope]]
path = "apps/web"
[scope.tools.eslint.rules]
eqeqeq = ["warn", "always"]
[[scope.tools.eslint.overrides]]
paths = ["**/*", "!apps/web/exempt.js"]
rules = {eqeqeq = ["error", "smart"]}
[[scope]]
path = "apps/web/admin"
[[scope.tools.eslint.overrides]]
paths = ["**/*"]
rules = {eqeqeq = ["error", "always"]}
`;
    const source = 'export const matches = (value) => value == null;\n';
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': source,
        'tests/unit.js': source,
        'tests/exempt.js': source,
        'apps/web/page.js': source,
        'apps/web/exempt.js': source,
        'apps/web/admin/page.js': source,
    });
    symlinkSync(modules, join(directory.path, 'node_modules'));
    const applied = await run(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    writeFileSync(join(directory.path, 'tests/future.js'), source);
    for (const ignored of [false, true]) {
        if (ignored) {
            writeFileSync(
                join(directory.path, 'gspot.toml'),
                policy + '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "eqeqeq"\npaths = ["tests"]\n',
            );
            const updated = await run(directory.path, ['apply']);
            expect(updated.code, updated.stdout + updated.stderr).toBe(0);
        }
        const lint = Bun.spawnSync(
            [
                join(modules, '.bin/eslint'),
                '--config',
                '.gspot/config/eslint.config.mjs',
                '--format',
                'json',
                'source.js',
                'tests',
                'apps',
            ],
            { cwd: directory.path },
        );
        expect(lint.exitCode, lint.stderr.toString()).not.toBe(2);
        const findings = JSON.parse(lint.stdout.toString()) as {
            filePath: string;
            messages: { ruleId: string; severity: number; line: number; column: number }[];
        }[];
        const actual = findings.flatMap(({ filePath, messages }) =>
            messages
                .filter(({ ruleId }) => ruleId === 'eqeqeq')
                .map(({ severity, line, column }) => ({
                    file: filePath.slice(directory.path.length + 1),
                    severity,
                    line,
                    column,
                })),
        );
        expect(actual).toStrictEqual([
            { file: 'apps/web/admin/page.js', severity: 2, line: 1, column: 41 },
            { file: 'apps/web/exempt.js', severity: 1, line: 1, column: 41 },
            ...(ignored
                ? []
                : [
                      { file: 'tests/future.js', severity: 2, line: 1, column: 41 },
                      { file: 'tests/unit.js', severity: 2, line: 1, column: 41 },
                  ]),
        ]);
    }
    const exported = exportedProfile(policy, 'project.profile.toml');
    expect(exported.text).not.toContain('overrides');
    expect(parseProfile(exported.text, 'project.profile.toml').tables.tools?.eslint?.rules?.['eqeqeq']).toStrictEqual([
        'error',
        'smart',
    ]);
    expect(exported.leftOut).toContain('tools.eslint.overrides[0]: names a repository path');
});

test('path-specific ignores prevent checker and fixer execution and report an entirely ignored selection', async () => {
    await using directory = await testdir();
    const command = [
        'node',
        '-e',
        String.raw`const fs = require("node:fs"); const paths = process.argv.slice(1); fs.appendFileSync("checked.txt", JSON.stringify(paths) + "\n"); process.exit(paths.some(path => fs.readFileSync(path, "utf8") !== "corrected\n") ? 1 : 0);`,
        '--',
        '{files}',
    ];
    const fix = [
        'node',
        '-e',
        String.raw`const fs = require("node:fs"); const paths = process.argv.slice(1); fs.appendFileSync("fixed.txt", JSON.stringify(paths) + "\n"); for (const path of paths) fs.writeFileSync(path, "corrected\n");`,
        '--',
        '{files}',
    ];
    const policy = `version = 1\nconfigurations = []\n[rules]\ninstall = false\n[[check]]\nname = "project/quality"\ncommand = ${JSON.stringify(command)}\nfix_command = ${JSON.stringify(fix)}\nfix_order = "codemod"\npaths = ["inputs/**"]\nstage = "commit"\n[[ignore]]\ncheck = "project/quality"\npaths = ["inputs/skip*", "!inputs/skip-keep.txt"]\n`;
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'inputs/regular.txt': 'defect\n',
        'inputs/skip café.txt': 'defect\n',
        'inputs/skip-keep.txt': 'defect\n',
    });
    const args = ['check', '--only', 'project/quality', '--fix', '--no-cache', '--json'];
    const corrected = await run(directory.path, args);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const report = reportSchema.parse(JSON.parse(corrected.stdout));
    expect(report.checks[0]).toMatchObject({ status: 'ok', files: 2, findings: [] });
    for (const log of ['checked.txt', 'fixed.txt'])
        expect(JSON.parse(readFileSync(join(directory.path, log), 'utf8').trim()).sort()).toStrictEqual([
            'inputs/regular.txt',
            'inputs/skip-keep.txt',
        ]);
    expect(readFileSync(join(directory.path, 'inputs/skip café.txt'), 'utf8')).toBe('defect\n');
    const checked = readFileSync(join(directory.path, 'checked.txt'), 'utf8');
    const fixed = readFileSync(join(directory.path, 'fixed.txt'), 'utf8');
    const skipped = await run(directory.path, [...args, '--', 'inputs/skip café.txt']);
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
    const skippedReport = reportSchema.parse(JSON.parse(skipped.stdout));
    expect(skippedReport.skips).toStrictEqual([{ check: 'project/quality', source: 'ignore' }]);
    expect(skippedReport.checks[0]).toMatchObject({ status: 'skipped', findings: [] });
    expect(skippedReport.coverage.checked).toBe(0);
    expect(readFileSync(join(directory.path, 'checked.txt'), 'utf8')).toBe(checked);
    expect(readFileSync(join(directory.path, 'fixed.txt'), 'utf8')).toBe(fixed);
    const restored = await run(directory.path, [
        'ignore',
        'project/quality',
        '--remove',
        '--paths',
        'inputs/skip*',
        '!inputs/skip-keep.txt',
    ]);
    expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    const accepted = await run(directory.path, [...args, '--', 'inputs/skip café.txt']);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(readFileSync(join(directory.path, 'inputs/skip café.txt'), 'utf8')).toBe('corrected\n');
});
