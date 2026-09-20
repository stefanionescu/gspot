import { createFixture } from 'fs-fixture';
import { rejects } from 'node:assert/strict';
import * as processes from '#cli/platform/spawn.ts';
import { basename, delimiter, join } from 'node:path';
import { describe, expect, spyOn, test } from 'bun:test';
import { commitAll, install, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';
import { chmodSync, existsSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';

// Mise is the subprocess boundary; the resulting search path must locate a real executable.
describe('the planted harness tool path', () => {
    test('preserves the first executable directory using native path separators', () => {
        const outcome = Bun.spawnSync([process.execPath, '--version'], { stdout: 'pipe', stderr: 'pipe' });
        const probe = spyOn(Bun, 'spawnSync').mockReturnValueOnce({
            ...outcome,
            stdout: Buffer.from(`${process.execPath}\n`),
        });
        let search: string;
        try {
            search = toolsPath(['bun']);
        } finally {
            probe.mockRestore();
        }
        const first = search.split(delimiter)[0]!;
        const executable = Bun.which(basename(process.execPath), { PATH: first });
        expect(executable).not.toBeNull();
        expect(realpathSync(executable!)).toBe(realpathSync(process.execPath));
    });
});

describe('the planted command deadline', () => {
    test('a timeout fails the case and restores its files and policy', async () => {
        const policy = 'version = 1\n';
        await using fixture = await createFixture({
            'gspot.toml': policy,
            'source.sql': 'select 1;\n',
            'removed.sql': 'select 2;\n',
        });
        const probe = spyOn(processes, 'run').mockResolvedValueOnce({
            isTimedOut: true,
            code: 1,
            missing: false,
            duration: 120_000,
            stdout: 'migration.sql:1: checking\n',
            stderr: 'waiting for tool\n',
        });
        try {
            await rejects(
                runPlanted(
                    fixture.path,
                    {
                        check: 'postgres/squawk',
                        files: { 'source.sql': 'bad sql', 'new.sql': 'bad sql' },
                        removed: ['removed.sql'],
                        policy: '# planted policy',
                        expected: 'unused',
                    },
                    {},
                ),
                {
                    message:
                        `Command gspot check postgres/squawk --no-cache timed out in ${fixture.path}.\n` +
                        'Duration: 120000 ms; exit: 1.\n' +
                        'stdout:\nmigration.sql:1: checking\n\nstderr:\nwaiting for tool\n',
                },
            );
        } finally {
            probe.mockRestore();
        }
        expect(await Bun.file(join(fixture.path, 'gspot.toml')).text()).toBe(policy);
        expect(await Bun.file(join(fixture.path, 'source.sql')).text()).toBe('select 1;\n');
        expect(await Bun.file(join(fixture.path, 'removed.sql')).text()).toBe('select 2;\n');
        expect(await Bun.file(join(fixture.path, 'new.sql')).exists()).toBe(false);
    });

    test('partial planting failure restores binary bytes, file modes, and new directories', async () => {
        const policy = 'version = 1\n';
        const original = Buffer.from([0, 255, 128, 13, 10]);
        await using fixture = await createFixture({
            'gspot.toml': policy,
            'script.sh': '#!/bin/sh\nexit 0\n',
        });
        const scriptPath = join(fixture.path, 'script.sh');
        const binaryPath = join(fixture.path, 'logo.png');
        const scriptBytes = readFileSync(scriptPath);
        chmodSync(scriptPath, 0o640);
        const mode = statSync(scriptPath).mode;
        writeFileSync(binaryPath, original);
        await rejects(
            runPlanted(
                fixture.path,
                {
                    check: 'bash/syntax',
                    files: { 'script.sh': 'broken', 'new/nested/source.sql': 'bad sql' },
                    removed: ['logo.png'],
                    executable: ['script.sh', 'absent.sh'],
                    expected: 'unused',
                },
                {},
            ),
            /ENOENT/,
        );
        expect(readFileSync(binaryPath)).toEqual(original);
        expect(readFileSync(scriptPath)).toEqual(scriptBytes);
        expect(statSync(scriptPath).mode).toBe(mode);
        expect(readFileSync(join(fixture.path, 'gspot.toml'), 'utf8')).toBe(policy);
        expect(existsSync(join(fixture.path, 'new'))).toBe(false);
    });

    test('a completed CLI preserves successful and nonzero statuses', async () => {
        await using fixture = await createFixture({});
        const version = await run(fixture.path, ['--version']);
        expect(version.code).toBe(0);
        expect(version.stdout.trim()).not.toBe('');
        const invalid = await run(fixture.path, ['--unknown-option']);
        expect(invalid.code).not.toBe(0);
        expect(invalid.stderr).toContain('unknown option');
    });
});

describe('required fixture setup', () => {
    test('invalid Git metadata stops fixture setup', async () => {
        await using fixture = await createFixture({ '.git': 'invalid git directory\n' });
        expect(() => {
            commitAll(fixture.path);
        }).toThrow('Fixture Git setup failed');
    });

    test('a missing required tool fails before a check runs', () => {
        const outcome = Bun.spawnSync([process.execPath, '--version'], { stdout: 'pipe', stderr: 'pipe' });
        const probe = spyOn(Bun, 'spawnSync').mockReturnValueOnce({
            ...outcome,
            exitCode: 1,
            stdout: Buffer.from(''),
            stderr: Buffer.from('not installed'),
        });
        try {
            expect(() => toolsPath(['shellcheck'])).toThrow('Run mise install shellcheck');
        } finally {
            probe.mockRestore();
        }
    });

    test('init failure is rejected even when a policy already exists', async () => {
        await using fixture = await createFixture({ 'gspot.toml': 'version = 1\n' });
        const probe = spyOn(processes, 'run').mockResolvedValueOnce({
            code: 1,
            missing: false,
            duration: 1,
            stdout: 'policy written',
            stderr: 'installation failed',
        });
        try {
            await rejects(install(fixture.path, ['init', '--yes']), /installation failed/);
        } finally {
            probe.mockRestore();
        }
    });

    test('an absent policy-edit target fails before changing fixture files', async () => {
        await using fixture = await createFixture({
            'gspot.toml': 'version = 1\n',
            'source.sql': 'select 1;\n',
        });
        await rejects(
            runPlanted(
                fixture.path,
                {
                    check: 'postgres/squawk',
                    files: { 'source.sql': 'bad sql' },
                    policyEdit: ['missing = true', 'missing = false'],
                    expected: 'unused',
                },
                {},
            ),
            /did not change the fixture/,
        );
        expect(await Bun.file(join(fixture.path, 'source.sql')).text()).toBe('select 1;\n');
    });
});
