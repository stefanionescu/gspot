// The hook gspot installs runs the staged checks on commit.
import { join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import { git, gspot, PLANTED_TIMEOUT_MS, run, script } from '#tests/harness/planted.ts';

describe('the gspot hook', () => {
    test(
        'the pre-commit hook runs the staged checks',
        async () => {
            await using sandbox = await createSandbox({ 'scripts/a.sh': script });
            git(sandbox.path, ['init', '-q']);
            git(sandbox.path, ['add', '-A']);
            git(sandbox.path, ['commit', '-qm', 'init']);
            await run(sandbox.path, [
                'init',
                '--yes',
                '--presets',
                'bash',
                '--runner',
                'none',
                '--ci',
                'none',
                '--no-rules',
                '--no-install',
            ]);
            await Bun.write(join(sandbox.path, 'scripts', 'b.sh'), '#!/usr/bin/env bash\necho $1\n');
            git(sandbox.path, ['add', '-A']);
            const commit = git(sandbox.path, ['commit', '-qm', 'bad'], { GSPOT_BIN: `bun ${gspot}`, NO_COLOR: '1' });
            expect(commit.code).not.toBe(0);
            expect(`${commit.stdout}${commit.stderr}`).toContain('SC2086');
        },
        PLANTED_TIMEOUT_MS,
    );
});
