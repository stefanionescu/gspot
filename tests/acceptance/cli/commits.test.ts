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
    '--no-rules',
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
            const init = await run(fixture.path, INIT);
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
            const draft = join(fixture.path, 'draft.txt');
            await Bun.write(draft, 'Fixed stuff.\n');
            const refused = await run(
                fixture.path,
                ['check', 'commits/commitlint', '--at', 'message', '--message-file', draft],
                environment,
            );
            expect(refused.code).toBe(1);
            expect(refused.stdout).toContain('commits/commitlint');
            const accepted = await run(fixture.path, ['check', 'commits/range', '--no-cache'], environment);
            expect(accepted.code).toBe(0);
            await Bun.write(join(fixture.path, 'more.md'), '# more\n');
            git(fixture.path, ['add', '-A']);
            git(fixture.path, ['commit', '-qm', 'Pushed past the hook.', '--no-verify']);
            const range = await run(fixture.path, ['check', 'commits/range', '--no-cache'], environment);
            expect(range.code).toBe(1);
            expect(range.stdout).toContain('type-empty');
        },
        PLANTED_TIMEOUT_MS,
    );
});
