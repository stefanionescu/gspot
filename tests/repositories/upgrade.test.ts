// upgrade: the report names the pin move and the files that change; the upgrade moves the pin and re-renders; another version is refused.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
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
            expect(run(fixture.path, INIT).stdout).toContain('write');
            const current = readFileSync(join(fixture.path, '.gspot', 'version'), 'utf8').trim();
            writeFileSync(join(fixture.path, '.gspot', 'version'), '0.0.1\n');
            chmodSync(join(fixture.path, '.gspot', 'shellcheckrc'), 0o644);
            appendFileSync(join(fixture.path, '.gspot', 'shellcheckrc'), '# an older render\n');
            const report = run(fixture.path, ['upgrade', '--check']);
            expect(report.code).toBe(0);
            expect(report.stdout).toContain(`gspot 0.0.1 -> ${current}`);
            expect(report.stdout).toContain('~ .gspot/shellcheckrc');
            const other = run(fixture.path, ['upgrade', '--to', '9.9.9', '--check']);
            expect(other.code).toBe(2);
            expect(other.stdout).toContain('Install gspot 9.9.9');
            const applied = run(fixture.path, ['upgrade', '--yes', '--no-install']);
            expect(applied.code).toBe(0);
            expect(readFileSync(join(fixture.path, '.gspot', 'version'), 'utf8').trim()).toBe(current);
            expect(readFileSync(join(fixture.path, '.gspot', 'shellcheckrc'), 'utf8')).not.toContain('an older render');
            expect(run(fixture.path, ['apply', '--check']).code).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );
});
