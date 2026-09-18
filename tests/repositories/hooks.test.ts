// The hook gspot installs runs the staged checks on commit.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { git, gspot, PLANTED_TIMEOUT_MS, run, script } from '#tests/harness/planted.ts';

describe('the gspot hook', () => {
    test(
        'the pre-commit hook runs the staged checks',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': script });
            git(fixture.path, ['init', '-q']);
            git(fixture.path, ['add', '-A']);
            git(fixture.path, ['commit', '-qm', 'init']);
            run(fixture.path, [
                'init',
                '--yes',
                '--presets',
                'bash',
                '--runner',
                'none',
                '--ci',
                'none',
                '--rules',
                'no',
                '--no-install',
            ]);
            await Bun.write(join(fixture.path, 'scripts', 'b.sh'), '#!/usr/bin/env bash\necho $1\n');
            git(fixture.path, ['add', '-A']);
            const commit = git(fixture.path, ['commit', '-qm', 'bad'], { GSPOT_BIN: `bun ${gspot}`, NO_COLOR: '1' });
            expect(commit.code).not.toBe(0);
            expect(`${commit.stdout}${commit.stderr}`).toContain('SC2086');
        },
        PLANTED_TIMEOUT_MS,
    );
});
