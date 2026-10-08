import { join } from 'node:path';
import { chmod } from 'node:fs/promises';
import { planRun } from '#cli/planning/plan.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { GspotError } from '#cli/platform/errors.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { isMacos } from '#tests/config/harness/platforms.ts';
import { checkedFindings } from '#cli/execution/command/findings.ts';

describe.if(isMacos)('native property lists', () => {
    test('xcode/plutil classifies mixed native parse and input failures as execution errors', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['xcode']),
            'bad.plist': '<plist><dict>',
            'private.plist': '<plist><dict/></plist>\n',
        });
        const session = await openSession(sandbox.path);
        const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['xcode/plutil'] });
        const paths = { cwd: sandbox.path, root: sandbox.path };
        await chmod(join(sandbox.path, 'private.plist'), 0);
        try {
            for (const path of ['missing.plist', 'private.plist']) {
                const mixed = await runTestCommand(['plutil', '-lint', 'bad.plist', path], { cwd: sandbox.path });
                expect(mixed.code).toBe(1);
                expect(mixed.stdout + mixed.stderr).toContain('Encountered unexpected EOF');
                expect(() => checkedFindings(planned!, mixed, paths)).toThrow(GspotError);
            }
        } finally {
            await chmod(join(sandbox.path, 'private.plist'), 0o600);
        }
        const failed = await runTestCommand(['plutil', '-lint', 'bad.plist'], { cwd: sandbox.path });
        expect(failed.code).toBe(1);
        expect(checkedFindings(planned!, failed, paths)).toContainEqual(containing({ file: 'bad.plist' }));
        await Bun.write(join(sandbox.path, 'bad.plist'), '<plist><dict/></plist>\n');
        const corrected = await runTestCommand(['plutil', '-lint', 'bad.plist', 'private.plist'], {
            cwd: sandbox.path,
        });
        expect(corrected.code).toBe(0);
        expect(checkedFindings(planned!, corrected, paths)).toStrictEqual([]);
    });
});
