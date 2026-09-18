// The commits preset: the commit-msg hook refuses a message outside the convention and passes one inside it.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { git, gspot, toolsPath, PLANTED_TIMEOUT_MS, run, script } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'commits',
    '--runner',
    'none',
    '--ci',
    'none',
    '--rules',
    'no',
    '--no-install',
];

describe('the commits preset', () => {
    test(
        'the commit-msg hook refuses a free-form message and takes a conventional one',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': script, 'README.md': '# planted\n' });
            git(fixture.path, ['init', '-q']);
            git(fixture.path, ['add', '-A']);
            git(fixture.path, ['commit', '-qm', 'init']);
            const init = run(fixture.path, INIT);
            expect(init.stdout).toContain('write');
            expect(fixture.path).toBeTruthy();
            await Bun.write(join(fixture.path, 'notes.md'), '# notes\n');
            git(fixture.path, ['add', '-A']);
            const environment = {
                GSPOT_BIN: `bun ${gspot}`,
                NO_COLOR: '1',
                PATH: toolsPath(['commitlint']),
            };
            const bad = git(fixture.path, ['commit', '-qm', 'Added notes.'], environment);
            expect(bad.code).not.toBe(0);
            expect(`${bad.stdout}${bad.stderr}`).toContain('type-empty');
            const good = git(fixture.path, ['commit', '-qm', 'docs: add the notes page'], environment);
            expect(good.code).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );
});
