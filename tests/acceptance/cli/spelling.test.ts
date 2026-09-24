import type { RunReport } from '#cli/types/reports.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { commitAll, git } from '#tests/support/cli/git.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { expect, test } from 'bun:test';
import { chmodSync, readFileSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test(
    'spelling corrections return findings when an ambiguous word needs a manual choice',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["spelling"]\n[rules]\ninstall = false\n',
            'sample.txt': 'teh wether\n',
        });
        const environment = { PATH: toolsPath(['typos']) };
        const applied = await run(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        commitAll(sandbox.path);
        const args = ['check', '--only', 'spelling/typos', '--no-cache', '--json', '--fix'];
        for (const attempt of [0, 1]) {
            const checked = await run(sandbox.path, args, environment);
            expect(checked.code, `Attempt ${String(attempt)}: ${checked.stdout}${checked.stderr}`).toBe(1);
            expect(readFileSync(join(sandbox.path, 'sample.txt'), 'utf8')).toBe('the wether\n');
            const report = JSON.parse(checked.stdout) as RunReport;
            expect(report.checks.flatMap((check) => check.findings)).toContainEqual(
                expect.objectContaining({ file: 'sample.txt', fixable: false }),
            );
        }
        await Bun.write(join(sandbox.path, 'sample.txt'), 'the whether\n');
        const corrected = await run(sandbox.path, args, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'spelling reports unusual filenames and Unicode columns, then accepts corrected content and filename',
    async () => {
        await using sandbox = await testdir();
        const paths = [
            'space name.txt',
            'teh.txt',
            ...(process.platform === 'win32' ? [] : ['name:part.txt', 'line\nbreak.txt', 'tab\tname.txt']),
        ];
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["spelling"]\n[rules]\ninstall = false\n',
            'the.txt': 'protected\n',
            ...Object.fromEntries(paths.map((path) => [path, 'café teh\n'])),
        });
        const environment = { PATH: toolsPath(['typos']) };
        const applied = await run(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        commitAll(sandbox.path);
        const args = ['check', '--only', 'spelling/typos', '--no-cache', '--json'];
        const checked = await run(sandbox.path, args, environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        const report = JSON.parse(checked.stdout) as RunReport;
        const findings = report.checks.flatMap((check) => check.findings);
        for (const path of paths)
            expect(findings).toContainEqual(expect.objectContaining({ file: path, line: 1, column: 6, fixable: true }));
        expect(findings).toContainEqual(
            expect.objectContaining({ file: 'teh.txt', message: 'Filename: `teh` should be `the`', fixable: false }),
        );
        await Bun.write(join(sandbox.path, 'space name.txt'), 'café teh teh\n');
        expect(git(sandbox.path, ['add', '--', 'space name.txt']).code).toBe(0);
        await Bun.write(join(sandbox.path, 'space name.txt'), 'the\n');
        const staged = await run(sandbox.path, [...args, '--staged'], environment);
        expect(staged.code, staged.stdout + staged.stderr).toBe(1);
        const stagedReport = JSON.parse(staged.stdout) as RunReport;
        expect(stagedReport.checks.flatMap((check) => check.findings)).toContainEqual(
            expect.objectContaining({ file: 'space name.txt', line: 1, column: 6 }),
        );
        expect(readFileSync(join(sandbox.path, 'space name.txt'), 'utf8')).toBe('the\n');
        await Bun.write(join(sandbox.path, 'space name.txt'), 'café teh\n');
        const fixed = await run(sandbox.path, [...args, '--fix'], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(1);
        for (const path of paths) expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe('café the\n');
        expect(readFileSync(join(sandbox.path, 'the.txt'), 'utf8')).toBe('protected\n');
        renameSync(join(sandbox.path, 'the.txt'), join(sandbox.path, 'protected.txt'));
        renameSync(join(sandbox.path, 'teh.txt'), join(sandbox.path, 'the.txt'));
        const corrected = await run(sandbox.path, args, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'scoped spelling adoption preserves exclusions and CLI checks ignore unowned native overrides',
    async () => {
        await using sandbox = await testdir();
        const original =
            '[default]\nlocale = "en-gb"\n[default.extend-words]\nteh = "teh"\n[files]\nextend-exclude = ["src/**", "*.skip", "!keep.skip"]\n';
        await createFileTree(sandbox.path, {
            'sample.txt': 'teh\n',
            'nested/typos.toml': original,
            'nested/sample.txt': 'colour teh\n',
            'nested/src/ignored.txt': 'recieve\n',
            'nested/ignored.skip': 'recieve\n',
            'nested/keep.skip': 'recieve\n',
        });
        chmodSync(join(sandbox.path, 'nested/typos.toml'), 0o640);
        const environment = { PATH: toolsPath(['typos']) };
        const initialized = await run(
            sandbox.path,
            [
                'init',
                '--yes',
                '--configurations',
                'spelling',
                '--no-install',
                '--no-hooks',
                '--no-runner',
                '--no-ci',
                '--no-rules',
            ],
            environment,
        );
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        const policy = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
        const configuration = readFileSync(join(sandbox.path, '.gspot/config/nested/typos.toml'), 'utf8');
        const invalid = await run(
            sandbox.path,
            ['set', 'tools.typos.locale', 'en_US', '--scope', 'nested'],
            environment,
        );
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
        expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
        expect(readFileSync(join(sandbox.path, '.gspot/config/nested/typos.toml'), 'utf8')).toBe(configuration);
        await createFileTree(sandbox.path, {
            'nested/rogue/typos.toml': '[default]\ncheck-file = false\n',
            'nested/rogue/sample.txt': 'recieve\n',
        });
        commitAll(sandbox.path);
        const args = ['check', '--only', 'spelling/typos', '--no-cache', '--json'];
        const checked = await run(sandbox.path, args, environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        const report = JSON.parse(checked.stdout) as RunReport;
        const findings = report.checks.flatMap((check) => check.findings);
        expect(findings).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ file: 'sample.txt' }),
                expect.objectContaining({ file: 'nested/keep.skip' }),
                expect.objectContaining({ file: 'nested/rogue/sample.txt' }),
            ]),
        );
        expect(findings, JSON.stringify(report.checks)).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ file: 'nested/src/ignored.txt' })]),
        );
        const fixed = await run(sandbox.path, [...args, '--fix'], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(readFileSync(join(sandbox.path, 'sample.txt'), 'utf8')).toBe('the\n');
        expect(readFileSync(join(sandbox.path, 'nested/keep.skip'), 'utf8')).toBe('receive\n');
        expect(readFileSync(join(sandbox.path, 'nested/rogue/sample.txt'), 'utf8')).toBe('receive\n');
        expect(readFileSync(join(sandbox.path, 'nested/src/ignored.txt'), 'utf8')).toBe('recieve\n');
        expect(readFileSync(join(sandbox.path, 'nested/sample.txt'), 'utf8')).toBe('colour teh\n');
        const corrected = await run(sandbox.path, args, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        chmodSync(join(sandbox.path, '.gspot/config/nested/typos.toml'), 0o644);
        await Bun.write(join(sandbox.path, '.gspot/config/nested/typos.toml'), '[default]\nlocale = "unknown"\n');
        const broken = await run(sandbox.path, args, environment);
        expect(broken.code, broken.stdout + broken.stderr).toBe(2);
        const brokenReport = JSON.parse(broken.stdout) as RunReport;
        expect(brokenReport.checks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ check: 'spelling/typos', scope: 'nested', status: 'error', findings: [] }),
            ]),
        );
        const preserved = await run(sandbox.path, ['apply'], environment);
        expect(preserved.code, preserved.stdout + preserved.stderr).toBe(2);
        expect(readFileSync(join(sandbox.path, '.gspot/config/nested/typos.toml'), 'utf8')).toContain('unknown');
        unlinkSync(join(sandbox.path, '.gspot/config/nested/typos.toml'));
        const restored = await run(sandbox.path, ['apply'], environment);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        expect(readFileSync(join(sandbox.path, '.gspot/config/nested/typos.toml'), 'utf8')).toBe(configuration);
        const removed = await run(sandbox.path, ['uninstall', '--yes'], environment);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(readFileSync(join(sandbox.path, 'nested/typos.toml'), 'utf8')).toBe(original);
        expect(statSync(join(sandbox.path, 'nested/typos.toml')).mode & 0o777).toBe(0o640);
    },
    PLANTED_TIMEOUT_MS,
);
