import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { COPY_PAGE_BUILD } from '#tests/data/checks/site/build.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { applySandboxChanges, registerSharedSandbox } from '#tests/setup/sandbox.ts';

import {
    AUTOPLAY_PAGE,
    AUTOPLAY_CHECKS,
    AUTOPLAY_SCOPE_SETTINGS,
    CONTROLLED_PLAYBACK_PAGE,
    CHECKS_HTML_INSTALLED_SANDBOX,
} from '#tests/data/checks/html.ts';

const installedSandbox = registerSharedSandbox(CHECKS_HTML_INSTALLED_SANDBOX);

test.each([...AUTOPLAY_CHECKS])(
    '$check reports audio and video autoplay and accepts user-controlled playback',
    async (entry) => {
        const { root } = installedSandbox();
        const skippedChecks =
            entry.scope === ''
                ? [{ check: entry.check, scope: 'app', status: 'skipped' as const, fileCount: 0, findings: [] }]
                : [];
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['html'], { level: 'all', tables: AUTOPLAY_SCOPE_SETTINGS }),
            'index.html': AUTOPLAY_PAGE,
            'app/page.html': AUTOPLAY_PAGE,
            'app/build.mjs': COPY_PAGE_BUILD,
        };
        await using _sourceChange = await applySandboxChanges(
            installedSandbox(),
            buildSandboxChanges(CHECKS_HTML_INSTALLED_SANDBOX.files, sourceFiles),
        );

        const settings = await readFile(join(root, 'gspot.toml'), 'utf8');
        const checked = parseCheckReport(await spawnGspot(root, entry.arguments));
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        expect(checked.report.checks).toMatchObject([
            {
                check: entry.check,
                scope: entry.scope,
                status: 'failed',
                findings: entry.findings.map((finding) => matchFields(finding)),
            },
            ...skippedChecks,
        ]);
        await writeFile(join(root, entry.source), CONTROLLED_PLAYBACK_PAGE);
        const corrected = parseCheckReport(await spawnGspot(root, entry.arguments));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([
            { check: entry.check, scope: entry.scope, status: 'passed', findings: [] },
            ...skippedChecks,
        ]);
        expect(await readFile(join(root, 'gspot.toml'), 'utf8')).toBe(settings);
        expect(await readFile(join(root, entry.preserved), 'utf8')).toBe(AUTOPLAY_PAGE);
        expect(await readFile(join(root, 'app/build.mjs'), 'utf8')).toBe(COPY_PAGE_BUILD);
    },
);
