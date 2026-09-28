import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { containing } from '#tests/support/expectations.ts';
import { checkedFindings } from '#cli/execution/broken-tool.ts';
import { ToolOutputError } from '#cli/execution/output/tool-formats.ts';

describe.if(process.platform === 'darwin')('native property lists', () => {
    test.each(['configs/plist', 'xcode/plist'])(
        '%s classifies mixed native parse and input failures as execution errors',
        async (check) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'gspot.toml': 'version = 1\nkits = ["configs", "xcode"]\n',
                'bad.plist': '<plist><dict>',
                'private.plist': '<plist><dict/></plist>\n',
            });
            const session = await openSession(sandbox.path);
            const [planned] = await planRun(session, { stage: 'commit', skips: [], only: [check] });
            const roots: [string, string] = [sandbox.path, sandbox.path];
            chmodSync(join(sandbox.path, 'private.plist'), 0);
            try {
                for (const path of ['missing.plist', 'private.plist']) {
                    const mixed = await run(['plutil', '-lint', 'bad.plist', path], { cwd: sandbox.path });
                    expect(mixed.code).toBe(1);
                    expect(mixed.stdout + mixed.stderr).toContain('Encountered unexpected EOF');
                    expect(() => checkedFindings(planned!, mixed, roots)).toThrow(ToolOutputError);
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
        },
    );
});
