import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { settingsText } from '#tests/setup/settings.ts';
import { COPY_PAGE_BUILD } from '#tests/config/site/build.ts';
import { installToolProjects } from '#tests/setup/install.ts';
import type { RunReport } from '#cli/types/execution/check.ts';

import {
    AUTOPLAY_PAGE,
    AUTOPLAY_CHECKS,
    AUTOPLAY_SCOPE_SETTINGS,
    CONTROLLED_PLAYBACK_PAGE,
} from '#tests/config/html.ts';

for (const entry of AUTOPLAY_CHECKS)
    test(`${entry.check} reports audio and video autoplay and accepts user-controlled playback`, async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['html'], { level: 'all', tables: AUTOPLAY_SCOPE_SETTINGS }),
            'index.html': AUTOPLAY_PAGE,
            'app/page.html': AUTOPLAY_PAGE,
            'app/build.mjs': COPY_PAGE_BUILD,
        });
        await installToolProjects(sandbox.path);
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
                findings: entry.findings.map((finding) => containing(finding)),
            },
        ]);
        await writeFile(join(sandbox.path, entry.source), CONTROLLED_PLAYBACK_PAGE);
        const corrected = await spawnGspot(sandbox.path, entry.arguments);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: entry.check, scope: entry.scope, status: 'passed', findings: [] },
        ]);
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
        expect(await readFile(join(sandbox.path, entry.preserved), 'utf8')).toBe(AUTOPLAY_PAGE);
        expect(await readFile(join(sandbox.path, 'app/build.mjs'), 'utf8')).toBe(COPY_PAGE_BUILD);
    });
