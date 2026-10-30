import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { writeSandboxChanges, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';

import {
    HTML_SANDBOX,
    AUTOPLAY_PAGE,
    AUTOPLAY_CHECKS,
    CONTROLLED_PLAYBACK_PAGE,
} from '#tests/config/integration/checks/language/language.ts';

const installedSandbox = shareInstalledSandbox(HTML_SANDBOX);

test.each([...AUTOPLAY_CHECKS])(
    '$check reports audio and video autoplay and accepts user-controlled playback',
    async (row) => {
        const { root } = installedSandbox();
        const skippedChecks =
            row.scope === ''
                ? [{ check: row.check, scope: 'app', status: 'skipped' as const, fileCount: 0, findings: [] }]
                : [];
        const build = buildProgramCommand('fakes/site-build', '--copy', 'page.html=dist/index.html');
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['html'], {
                level: 'all',
                tables: `[[scope]]\npath = "app"\nconfigurations = ["site"]\n[scope.site]\nbuild_command = ${JSON.stringify(build)}\n`,
            }),
            'index.html': AUTOPLAY_PAGE,
            'app/page.html': AUTOPLAY_PAGE,
        };
        await using _sourceChange = await writeSandboxChanges(
            installedSandbox(),
            buildSandboxChanges(HTML_SANDBOX.files, sourceFiles),
        );

        const checked = parseCheckReport(await spawnGspot(root, row.arguments));
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        expect(checked.report.checks).toMatchObject([
            {
                check: row.check,
                scope: row.scope,
                status: 'failed',
                findings: row.findings.map((finding) => matchFields(finding)),
            },
            ...skippedChecks,
        ]);
        await writeFile(join(root, row.source), CONTROLLED_PLAYBACK_PAGE);
        const corrected = parseCheckReport(await spawnGspot(root, row.arguments));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([
            { check: row.check, scope: row.scope, status: 'passed', findings: [] },
            ...skippedChecks,
        ]);
    },
);
