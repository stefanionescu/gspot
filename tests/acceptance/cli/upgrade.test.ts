// upgrade: the report names the pin move and the files that change; the upgrade moves the pin and re-renders; another version is refused.
import { join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import { treeContents } from '#tests/harness/contents.ts';
import { appendFileSync, chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { git, PLANTED_TIMEOUT_MS, run, script } from '#tests/harness/planted.ts';

const INIT = ['init', '--yes', '--presets', 'bash', '--runner', 'none', '--ci', 'none', '--no-rules', '--no-install'];

describe('upgrade', () => {
    test(
        'reports what changes, moves the pin and re-renders on a yes, and refuses another version',
        async () => {
            await using sandbox = await createSandbox({ 'scripts/a.sh': script });
            git(sandbox.path, ['init', '-q']);
            git(sandbox.path, ['add', '-A']);
            git(sandbox.path, ['commit', '-qm', 'init']);
            const initialized = await run(sandbox.path, INIT);
            expect(initialized.stdout).toContain('write');
            const current = readFileSync(join(sandbox.path, '.gspot', 'version'), 'utf8').trim();
            writeFileSync(join(sandbox.path, '.gspot', 'version'), '0.0.1\n');
            chmodSync(join(sandbox.path, '.gspot', 'shellcheckrc'), 0o644);
            appendFileSync(join(sandbox.path, '.gspot', 'shellcheckrc'), '# an older render\n');
            const before = treeContents(sandbox.path);
            const report = await run(sandbox.path, ['upgrade', '--dry-run']);
            expect(report.code).toBe(0);
            expect(report.stdout).toContain(`gspot 0.0.1 -> ${current}`);
            expect(report.stdout).toContain('~ .gspot/shellcheckrc');
            expect(treeContents(sandbox.path)).toEqual(before);
            const other = await run(sandbox.path, ['upgrade', '--to', '9.9.9', '--dry-run']);
            expect(other.code).toBe(2);
            expect(other.stdout).toContain('Install gspot 9.9.9');
            expect(treeContents(sandbox.path)).toEqual(before);
            const applied = await run(sandbox.path, ['upgrade', '--yes', '--no-install']);
            expect(applied.code).toBe(0);
            expect(readFileSync(join(sandbox.path, '.gspot', 'version'), 'utf8').trim()).toBe(current);
            expect(readFileSync(join(sandbox.path, '.gspot', 'shellcheckrc'), 'utf8')).not.toContain('an older render');
            const drift = await run(sandbox.path, ['apply', '--check']);
            expect(drift.code).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );
});
