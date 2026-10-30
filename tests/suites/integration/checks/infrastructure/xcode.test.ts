import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect, describe } from 'bun:test';
import { chmod, writeFile } from 'node:fs/promises';
import { planChecks } from '#cli/planning/checks.ts';
import { openSession } from '#cli/planning/session.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { parseCommandFindings } from '#cli/runs/command/output.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { isMacos, hasToolBuild } from '#tests/setup/system/platform.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { XCODE_CASES, PLUTIL_UNREADABLE_FILES } from '#tests/config/integration/checks/infrastructure.ts';

describe.skipIf(!isMacos)('Xcode samples', () => {
    const installedSandbox = shareInstalledSandbox({
        install: false,
        configurations: ['xcode'],
        files: {},
    });
    test.each([...XCODE_CASES])('$check reports $expected.file and passes after the fix', async (sample) => {
        await assertCheckSample(installedSandbox(), sample);
    });
});

test.skipIf(!hasToolBuild('plutil'))(
    'xcode/plutil turns a parse error beside a missing or unreadable file into a note that names both files, and a parse error alone into a finding',
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
        for (const path of PLUTIL_UNREADABLE_FILES) {
            const mixed = await runCommand(['plutil', '-lint', 'bad.plist', path], { cwd: sandbox.path });
            expect(mixed.code).toBe(1);
            const { findings, note = '' } = parseCommandFindings(planned!, mixed, paths);
            expect(findings).toBeUndefined();
            expect(note).toStartWith('plutil failed with exit 1:\nbad.plist: ');
            expect(note).toContain(`\n${path}: `);
        }
        await chmod(join(sandbox.path, 'private.plist'), 0o600);

        const failed = await runCommand(['plutil', '-lint', 'bad.plist'], { cwd: sandbox.path });
        expect(failed.code).toBe(1);
        const { findings } = parseCommandFindings(planned!, failed, paths);
        expect(findings).toHaveLength(1);
        expect(findings).toMatchObject([
            { check: 'xcode/plutil', file: 'bad.plist', fixable: false, help: 'Fix the element plutil names.' },
        ]);
        await writeFile(join(sandbox.path, 'bad.plist'), '<plist><dict/></plist>\n');
        const corrected = await runCommand(['plutil', '-lint', 'bad.plist', 'private.plist'], {
            cwd: sandbox.path,
        });
        expect(corrected.code).toBe(0);
        expect(parseCommandFindings(planned!, corrected, paths).findings).toStrictEqual([]);
    },
);
