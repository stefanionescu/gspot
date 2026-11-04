import { join } from 'node:path';
import { chmod } from 'node:fs/promises';
import { planChecks } from '#cli/engine/plan.ts';
import { test, expect, describe } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { parseCommandFindings } from '#cli/engine/tool-runs/output.ts';
import { isMacos, hasToolBuild } from '#tests/setup/system/platform.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { XCODE_CASES, PLUTIL_UNREADABLE_FILES } from '#tests/config/integration/infrastructure.ts';

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
    'xcode/plutil turns a parse error beside a missing or unreadable file into a note that names both files',
    async () => {
        await using sandbox = await createGitSandbox({
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
            const { findings, note = '' } = parseCommandFindings(planned!, mixed, paths, {});
            expect(findings).toBeUndefined();
            expect(note).toContain('bad.plist: ');
            expect(note).toContain(`\n${path}: `);
        }
        await chmod(join(sandbox.path, 'private.plist'), 0o600);
    },
);
