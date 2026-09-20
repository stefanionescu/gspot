import { realpathSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
import { rejects } from 'node:assert/strict';
import * as processes from '#cli/platform/spawn.ts';
import { basename, delimiter, join } from 'node:path';
import { describe, expect, spyOn, test } from 'bun:test';
import { run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

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
