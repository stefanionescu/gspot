import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { chmod } from 'node:fs/promises';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { openSession } from '#cli/commands/session.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import { commandOutcome } from '#cli/checks/run/command/output.ts';
import { XCODE_CASES, XCODE_SANDBOX } from '#tests/config/xcode.ts';
import { isMacos, hasToolBuild } from '#tests/setup/operating-systems.ts';

const sandbox = shareInstalledSandbox(XCODE_SANDBOX);
for (const entry of XCODE_CASES) {
    // This check needs the Xcode toolchain supplied by macOS.
    test.skipIf(!isMacos)(`${entry.check} reports ${entry.expected.file} and passes after the fix`, async () => {
        await runCheckSample(sandbox(), entry, XCODE_SANDBOX);
    });
}

// The pinned plutil tool has no build for some operating systems.
test.skipIf(!hasToolBuild('plutil'))(
    'xcode/plutil reports mixed parse and input failures as execution errors',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['xcode']),
            'bad.plist': '<plist><dict>',
            'private.plist': '<plist><dict/></plist>\n',
        });
        const session = await openSession(sandbox.path);
        const [planned] = planRun(session, { stage: 'commit', only: ['xcode/plutil'] });
        const paths = { cwd: sandbox.path, root: sandbox.path };
        await chmod(join(sandbox.path, 'private.plist'), 0);
        try {
            for (const { path, reason } of [
                { path: 'missing.plist', reason: 'no such file' },
                { path: 'private.plist', reason: 'permission' },
            ]) {
                const mixed = await runCommand(['plutil', '-lint', 'bad.plist', path], { cwd: sandbox.path });
                expect(mixed.code).toBe(1);
                expect(mixed.stdout + mixed.stderr).toContain('Encountered unexpected EOF');
                expect(commandOutcome(planned!, mixed, paths).note).toContain(reason);
            }
        } finally {
            await chmod(join(sandbox.path, 'private.plist'), 0o600);
        }
        const failed = await runCommand(['plutil', '-lint', 'bad.plist'], { cwd: sandbox.path });
        expect(failed.code).toBe(1);
        expect(commandOutcome(planned!, failed, paths).findings).toContainEqual(containing({ file: 'bad.plist' }));
        await Bun.write(join(sandbox.path, 'bad.plist'), '<plist><dict/></plist>\n');
        const corrected = await runCommand(['plutil', '-lint', 'bad.plist', 'private.plist'], {
            cwd: sandbox.path,
        });
        expect(corrected.code).toBe(0);
        expect(commandOutcome(planned!, corrected, paths).findings).toStrictEqual([]);
    },
);
