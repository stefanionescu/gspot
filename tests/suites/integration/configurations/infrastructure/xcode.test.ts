import { test, expect, describe } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { planChecks } from '#cli/engine/plan/checks.ts';
import { isMacos } from '#tests/setup/system/platform.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { parseCommandFindings } from '#cli/engine/run/tool-runs/output.ts';

const PLUTIL_SAMPLE = {
    check: 'xcode/plutil',
    files: { 'app/Info.plist': '<plist><dict><key>A</key></plist>\n' },
    expected: { file: 'app/Info.plist' },
    corrected: {
        files: {
            'app/Info.plist':
                '<?xml version="1.0"?><plist version="1.0"><dict><key>A</key><string>value</string></dict></plist>\n',
        },
    },
} as const;

describe.skipIf(!isMacos)('Xcode samples', () => {
    const installedSandbox = shareInstalledSandbox({
        install: false,
        configurations: ['xcode'],
        files: {},
    });
    test('xcode/plutil reports app/Info.plist and passes after the fix', async () => {
        await assertCheckSample(installedSandbox(), PLUTIL_SAMPLE);
    });

    test('xcode/plutil turns a parse error beside a missing file into a note that names both files', async () => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['xcode']),
            'bad.plist': '<plist><dict>',
        });

        const session = await openSession(sandbox.path);
        const [planned] = planChecks(session, { stage: 'commit', only: ['xcode/plutil'] });
        const paths = { cwd: sandbox.path, root: sandbox.path };
        const mixed = await runCommand(['plutil', '-lint', 'bad.plist', 'missing.plist'], { cwd: sandbox.path });
        expect(mixed.code).toBe(1);
        const { findings, note = '' } = parseCommandFindings(planned!, mixed, paths, {});
        expect(findings).toBeUndefined();
        expect(note).toContain('bad.plist: ');
        expect(note).toContain('\nmissing.plist: ');
    });
});
