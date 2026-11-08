import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import {
    AUTOPLAY_CHECKS,
    AUTOPLAY_PAGE,
    CONTROLLED_PLAYBACK_PAGE,
    HTML_SANDBOX,
} from '#tests/config/integration/language.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildSandboxChanges, writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

const installedSandbox = shareInstalledSandbox(HTML_SANDBOX);

test.each([...AUTOPLAY_CHECKS])(
    '$check reports audio and video autoplay and accepts user-controlled playback',
    async (row) => {
        const { root } = installedSandbox();
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['html'], { level: 'all' }),
            'index.html': AUTOPLAY_PAGE,
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
        ]);
        await writeFile(join(root, row.source), CONTROLLED_PLAYBACK_PAGE);
        const corrected = parseCheckReport(await spawnGspot(root, row.arguments));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([
            { check: row.check, scope: row.scope, status: 'passed', findings: [] },
        ]);
    },
);
