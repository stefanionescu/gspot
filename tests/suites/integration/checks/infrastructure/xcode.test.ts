import { join } from 'node:path';
import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, expect, describe } from 'bun:test';
import { chmod, writeFile } from 'node:fs/promises';
import { planChecks } from '#cli/planning/checks.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { parseCommandFindings } from '#cli/runs/command/output.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { isMacos, hasToolBuild } from '#tests/setup/system/platform.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

import {
    XCODE_CASES,
    XCODE_SANDBOX,
    PLUTIL_UNREADABLE_FILES,
} from '#tests/config/integration/checks/infrastructure/xcode.ts';

describe.skipIf(!isMacos)('Xcode samples', () => {
    const installedSandbox = shareInstalledSandbox(XCODE_SANDBOX);
    test.each([...XCODE_CASES])('$check reports $expected.file and passes after the fix', async (sample) => {
        const result = await runCheckSample(installedSandbox(), sample, XCODE_SANDBOX);
        expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(sample));
    });
});

test.skipIf(!hasToolBuild('plutil'))(
    'xcode/plutil turns a parse error beside a missing or unreadable file into a note that names the reason, and a parse error alone into a finding',
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
            for (const { path, reason } of PLUTIL_UNREADABLE_FILES) {
                const mixed = await runCommand(['plutil', '-lint', 'bad.plist', path], { cwd: sandbox.path });
                expect(mixed.code).toBe(1);
                expect(parseCommandFindings(planned!, mixed, paths)).toStrictEqual({
                    note: `plutil failed with exit 1:\nbad.plist: (Encountered unexpected EOF)\n${path}: (${reason})`,
                });
            }
        } finally {
            await chmod(join(sandbox.path, 'private.plist'), 0o600);
        }
        const failed = await runCommand(['plutil', '-lint', 'bad.plist'], { cwd: sandbox.path });
        expect(failed.code).toBe(1);
        expect(parseCommandFindings(planned!, failed, paths)).toStrictEqual({
            findings: [
                {
                    check: 'xcode/plutil',
                    file: 'bad.plist',
                    fixable: false,
                    help: 'Fix the element plutil names.',
                    message: 'Encountered unexpected EOF',
                },
            ],
        });
        await writeFile(join(sandbox.path, 'bad.plist'), '<plist><dict/></plist>\n');
        const corrected = await runCommand(['plutil', '-lint', 'bad.plist', 'private.plist'], {
            cwd: sandbox.path,
        });
        expect(corrected.code).toBe(0);
        expect(parseCommandFindings(planned!, corrected, paths).findings).toStrictEqual([]);
    },
);
