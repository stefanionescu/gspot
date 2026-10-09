import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runTestCommand } from '#tests/harness/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { copyInstalledModule } from '#tests/harness/platforms.ts';
import { SITE_HTML_BUILD } from '#tests/config/tools/generation/site-html.ts';
import type { HtmlValidationConfiguration } from '#tests/types/tools/generation/html.ts';

import {
    HTML_ACCESSIBILITY_PAGE,
    HTML_ACCESSIBILITY_CHECKS,
    HTML_ACCESSIBILITY_SCOPES,
    HTML_ACCESSIBILITY_CORRECTED,
} from '#tests/config/tools/generation/html-accessibility.ts';

for (const entry of HTML_ACCESSIBILITY_CHECKS)
    test.each(['recommended', 'all'] as const)(
        `%s ${entry.check} reports audio and video autoplay and accepts user-controlled playback`,
        async (level) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'gspot.toml': buildPolicy(['html'], { level, tables: HTML_ACCESSIBILITY_SCOPES }),
                'index.html': HTML_ACCESSIBILITY_PAGE,
                'app/page.html': HTML_ACCESSIBILITY_PAGE,
                'app/build.mjs': SITE_HTML_BUILD,
            });
            await copyInstalledModule(join(sandbox.path, '.gspot/node_modules'), 'html-validate');
            const applied = await spawnGspot(sandbox.path, ['apply']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            const policy = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
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
            const native = await runTestCommand(
                [
                    'node',
                    '.gspot/node_modules/html-validate/bin/html-validate.mjs',
                    '--config',
                    entry.configuration,
                    '--print-config',
                    entry.source,
                ],
                { cwd: sandbox.path },
            );
            expect(native.code, native.stdout + native.stderr).toBe(0);
            expect((JSON.parse(native.stdout) as HtmlValidationConfiguration).rules['no-autoplay']).toStrictEqual([
                'error',
                { include: ['audio', 'video'] },
            ]);
            await writeFile(join(sandbox.path, entry.source), HTML_ACCESSIBILITY_CORRECTED);
            const corrected = await spawnGspot(sandbox.path, entry.arguments);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
                { check: entry.check, scope: entry.scope, status: 'passed', findings: [] },
            ]);
            expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
            expect(await readFile(join(sandbox.path, entry.preserved), 'utf8')).toBe(HTML_ACCESSIBILITY_PAGE);
            expect(await readFile(join(sandbox.path, 'app/build.mjs'), 'utf8')).toBe(SITE_HTML_BUILD);
        },
    );
