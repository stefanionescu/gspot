// upgrade: the report names the pin move and the files that change; the upgrade moves the pin and re-renders; another version is refused.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { treeContents } from '#tests/harness/contents.ts';
import { appendFileSync, chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { git, PLANTED_TIMEOUT_MS, run, script } from '#tests/harness/planted.ts';

const INIT = ['init', '--yes', '--presets', 'bash', '--runner', 'none', '--ci', 'none', '--no-rules', '--no-install'];

describe('upgrade', () => {
    test(
        'reports what changes, moves the pin and re-renders on a yes, and refuses another version',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': script });
            git(fixture.path, ['init', '-q']);
            git(fixture.path, ['add', '-A']);
            git(fixture.path, ['commit', '-qm', 'init']);
            const initialized = await run(fixture.path, INIT);
            expect(initialized.stdout).toContain('write');
            const current = readFileSync(join(fixture.path, '.gspot', 'version'), 'utf8').trim();
            writeFileSync(join(fixture.path, '.gspot', 'version'), '0.0.1\n');
            chmodSync(join(fixture.path, '.gspot', 'shellcheckrc'), 0o644);
            appendFileSync(join(fixture.path, '.gspot', 'shellcheckrc'), '# an older render\n');
            const before = treeContents(fixture.path);
            const report = await run(fixture.path, ['upgrade', '--dry-run']);
            expect(report.code).toBe(0);
            expect(report.stdout).toContain(`gspot 0.0.1 -> ${current}`);
            expect(report.stdout).toContain('~ .gspot/shellcheckrc');
            expect(treeContents(fixture.path)).toEqual(before);
            const other = await run(fixture.path, ['upgrade', '--to', '9.9.9', '--dry-run']);
            expect(other.code).toBe(2);
            expect(other.stdout).toContain('Install gspot 9.9.9');
            expect(treeContents(fixture.path)).toEqual(before);
            const applied = await run(fixture.path, ['upgrade', '--yes', '--no-install']);
            expect(applied.code).toBe(0);
            expect(readFileSync(join(fixture.path, '.gspot', 'version'), 'utf8').trim()).toBe(current);
            expect(readFileSync(join(fixture.path, '.gspot', 'shellcheckrc'), 'utf8')).not.toContain('an older render');
            const drift = await run(fixture.path, ['apply', '--check']);
            expect(drift.code).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );
});
