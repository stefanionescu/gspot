import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { GspotError } from '#cli/platform/errors.ts';
import { onMac } from '#tests/harness/cli/platforms.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { containing } from '#tests/harness/expectations.ts';
import { checkedFindings } from '#cli/execution/tool/findings.ts';

describe.if(onMac)('native property lists', () => {
    test('files/plist classifies mixed native parse and input failures as execution errors', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['files']),
            'bad.plist': '<plist><dict>',
            'private.plist': '<plist><dict/></plist>\n',
        });
        const session = await openSession(sandbox.path);
        const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['files/plist'] });
        const roots: [string, string] = [sandbox.path, sandbox.path];
        chmodSync(join(sandbox.path, 'private.plist'), 0);
        try {
            for (const path of ['missing.plist', 'private.plist']) {
                const mixed = await run(['plutil', '-lint', 'bad.plist', path], { cwd: sandbox.path });
                expect(mixed.code).toBe(1);
                expect(mixed.stdout + mixed.stderr).toContain('Encountered unexpected EOF');
                expect(() => checkedFindings(planned!, mixed, roots)).toThrow(GspotError);
            }
        } finally {
            chmodSync(join(sandbox.path, 'private.plist'), 0o600);
        }
        const defect = await run(['plutil', '-lint', 'bad.plist'], { cwd: sandbox.path });
        expect(defect.code).toBe(1);
        expect(checkedFindings(planned!, defect, roots)).toContainEqual(containing({ file: 'bad.plist' }));
        await Bun.write(join(sandbox.path, 'bad.plist'), '<plist><dict/></plist>\n');
        const corrected = await run(['plutil', '-lint', 'bad.plist', 'private.plist'], { cwd: sandbox.path });
        expect(corrected.code).toBe(0);
        expect(checkedFindings(planned!, corrected, roots)).toStrictEqual([]);
    });
});
