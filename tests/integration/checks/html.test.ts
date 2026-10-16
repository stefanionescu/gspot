import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { COPY_PAGE_BUILD } from '#tests/data/checks/site/build.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';

import {
    AUTOPLAY_PAGE,
    AUTOPLAY_CHECKS,
    AUTOPLAY_SCOPE_SETTINGS,
    CONTROLLED_PLAYBACK_PAGE,
    CHECKS_HTML_INSTALLED_SANDBOX,
} from '#tests/data/checks/html.ts';

const installedSandbox = registerSharedSandbox(CHECKS_HTML_INSTALLED_SANDBOX);

for (const entry of AUTOPLAY_CHECKS)
    test(`${entry.check} reports audio and video autoplay and accepts user-controlled playback`, async () => {
        const sandbox = { path: installedSandbox().root };
        const skippedChecks =
            entry.scope === ''
                ? [{ check: entry.check, scope: 'app', status: 'skipped' as const, fileCount: 0, findings: [] }]
                : [];
        const sourceFiles = {
            'gspot.toml': buildSettingsText(['html'], { level: 'all', tables: AUTOPLAY_SCOPE_SETTINGS }),
            'index.html': AUTOPLAY_PAGE,
            'app/page.html': AUTOPLAY_PAGE,
            'app/build.mjs': COPY_PAGE_BUILD,
        };
        await using _sourceChange = await updateSandbox(installedSandbox(), {
            check: '',
            files: sourceFiles,
            removed: Object.keys(CHECKS_HTML_INSTALLED_SANDBOX.files).filter(
                (path) => path !== '.gitignore' && !Object.hasOwn(sourceFiles, path),
            ),
        });
        expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const settings = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
        const checked = await spawnGspot(sandbox.path, entry.arguments);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
            {
                check: entry.check,
                scope: entry.scope,
                status: 'failed',
                findings: entry.findings.map((finding) => matchFields(finding)),
            },
            ...skippedChecks,
        ]);
        await writeFile(join(sandbox.path, entry.source), CONTROLLED_PLAYBACK_PAGE);
        const corrected = await spawnGspot(sandbox.path, entry.arguments);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: entry.check, scope: entry.scope, status: 'passed', findings: [] },
            ...skippedChecks,
        ]);
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
        expect(await readFile(join(sandbox.path, entry.preserved), 'utf8')).toBe(AUTOPLAY_PAGE);
        expect(await readFile(join(sandbox.path, 'app/build.mjs'), 'utf8')).toBe(COPY_PAGE_BUILD);
    });
