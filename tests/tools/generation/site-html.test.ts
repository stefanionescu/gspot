import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { toolPin } from '#cli/configurations/pins.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runTestCommand } from '#tests/harness/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { HtmlValidationConfiguration } from '#tests/types/generation/configuration-files.ts';

import {
    SITE_HTML_PAGE,
    SITE_HTML_BUILD,
    SITE_HTML_SCOPES,
    SITE_HTML_CORRECTED,
    SITE_HTML_RULE_SCOPES,
    SITE_HTML_REPOSITORIES,
    SITE_HTML_INSTALL_ARGUMENTS,
} from '#tests/config/tools/generation/site-html.ts';

for (const repository of SITE_HTML_REPOSITORIES)
    test.each(['recommended', 'all'] as const)(
        `%s keeps built HTML exceptions confined with ${repository.name}`,
        async (level) => {
            await using sandbox = await testdir();
            const policy = buildPolicy(repository.configurations, { level, tables: SITE_HTML_SCOPES });
            await createFileTree(sandbox.path, {
                'gspot.toml': policy,
                ...repository.files,
                'app/build.mjs': SITE_HTML_BUILD,
                'app/page.html': SITE_HTML_PAGE,
                'other/build.mjs': SITE_HTML_BUILD,
                'other/page.html': SITE_HTML_PAGE,
            });
            const packagePin = toolPin(configurationManifests().values(), 'html-validate').installers['npm']!;
            const installed = await runTestCommand(
                [...SITE_HTML_INSTALL_ARGUMENTS, `${packagePin.name}@${packagePin.version!}`],
                { cwd: sandbox.path },
            );
            expect(installed.code, installed.stdout + installed.stderr).toBe(0);
            const applied = await spawnGspot(sandbox.path, ['apply']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            const appliedPolicy = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
            const checked = await spawnGspot(sandbox.path, ['check', '--json', '--only', 'site/html-validate']);
            expect(checked.code, checked.stdout + checked.stderr).toBe(1);
            expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
                { scope: 'app', status: 'passed', findings: [] },
                {
                    scope: 'other',
                    status: 'failed',
                    findings: [containing({ file: 'other/dist/index.html', line: 7, rule: 'wcag/h37' })],
                },
            ]);
            expect(await pathExists(join(sandbox.path, '.gspot/config/html-validate-built.json'))).toBe(false);
            for (const [scope, severity] of SITE_HTML_RULE_SCOPES) {
                const native = await runTestCommand(
                    [
                        'node',
                        '.gspot/node_modules/html-validate/bin/html-validate.mjs',
                        '--config',
                        `.gspot/config/${scope}/html-validate-built.json`,
                        '--print-config',
                        `${scope}/page.html`,
                    ],
                    { cwd: sandbox.path },
                );
                expect(native.code, native.stdout + native.stderr).toBe(0);
                const document = JSON.parse(native.stdout) as HtmlValidationConfiguration;
                expect(document.rules['wcag/h37']).toBe(severity);
            }
            await writeFile(join(sandbox.path, 'other/page.html'), SITE_HTML_CORRECTED);
            const corrected = await spawnGspot(sandbox.path, ['check', '--json', '--only', 'site/html-validate']);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
                { scope: 'app', status: 'passed', findings: [] },
                { scope: 'other', status: 'passed', findings: [] },
            ]);
            expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(appliedPolicy);
            for (const scope of ['app', 'other'])
                expect(await readFile(join(sandbox.path, `${scope}/build.mjs`), 'utf8')).toBe(SITE_HTML_BUILD);
        },
    );
