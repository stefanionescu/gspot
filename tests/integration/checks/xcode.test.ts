import { join } from 'node:path';
import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, expect, describe } from 'bun:test';
import { chmod, writeFile } from 'node:fs/promises';
import { planChecks } from '#cli/planning/checks.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { isMacos, hasToolBuild } from '#tests/setup/system.ts';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { parseCommandFindings } from '#cli/runs/command/output.ts';
import { XCODE_CASES, XCODE_SANDBOX } from '#tests/data/checks/xcode.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/sample-checks.ts';

describe.skipIf(!isMacos)('Xcode samples', () => {
    const installedSandbox = registerSharedSandbox(XCODE_SANDBOX);
    test.each([...XCODE_CASES])('$check reports $expected.file and passes after the fix', async (entry) => {
        const result = await runCheckSample(installedSandbox(), entry, XCODE_SANDBOX);
        expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
    });
});

test.skipIf(!hasToolBuild('plutil'))(
    'xcode/plutil reports mixed parse and input failures as execution errors',
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['xcode']),
            'bad.plist': '<plist><dict>',
            'private.plist': '<plist><dict/></plist>\n',
        });

        const session = await openSession(sandbox.path);
        const [planned] = planChecks(session, { stage: 'commit', only: ['xcode/plutil'] });
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
                expect(parseCommandFindings(planned!, mixed, paths).note).toContain(reason);
            }
        } finally {
            await chmod(join(sandbox.path, 'private.plist'), 0o600);
        }
        const failed = await runCommand(['plutil', '-lint', 'bad.plist'], { cwd: sandbox.path });
        expect(failed.code).toBe(1);
        expect(parseCommandFindings(planned!, failed, paths).findings).toContainEqual(
            matchFields({ file: 'bad.plist' }),
        );
        await writeFile(join(sandbox.path, 'bad.plist'), '<plist><dict/></plist>\n');
        const corrected = await runCommand(['plutil', '-lint', 'bad.plist', 'private.plist'], {
            cwd: sandbox.path,
        });
        expect(corrected.code).toBe(0);
        expect(parseCommandFindings(planned!, corrected, paths).findings).toStrictEqual([]);
    },
);
