import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { pathExists } from '#tests/setup/files.ts';
import { containing } from '#tests/setup/matchers.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { SITE_SANDBOX } from '#tests/config/site/project.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import { runGspot, spawnGspot } from '#tests/setup/run-gspot.ts';

import {
    SITE_CASES,
    SITE_SETTINGS,
    COPY_PAGE_BUILD,
    TWO_SITE_SCOPES,
    BUILT_HTML_SITES,
    SITE_OUTPUT_BUILD,
} from '#tests/config/site/build.ts';
import {
    OUTPUT_CASES,
    ALT_TEXT_PAGE,
    SITE_PAGE_HEAD,
    MISSING_ALT_PAGE,
    USED_SELECTOR_CSS,
    USED_SELECTOR_BODY,
    REVIEWED_SELECTOR_SETTINGS,
} from '#tests/config/site/built-pages.ts';

const installedSandbox = shareInstalledSandbox(SITE_SANDBOX);

test.each([...SITE_CASES])('$check reports its finding and passes after the fix', async (entry) => {
    const { failed, passed } = await runCheckSample(installedSandbox(), entry, SITE_SANDBOX);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.filter(({ status }) => status !== 'passed')).toMatchObject([
        { check: entry.check, status: 'failed' },
    ]);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toContainEqual(
        containing({ check: entry.check, ...entry.expected }),
    );
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect(passed.report.checks).toMatchObject(
        failed.report.checks.map(({ check, scope }) => ({ check, scope, status: 'passed', findings: [] })),
    );
});

test.each([...OUTPUT_CASES])(
    '$check reports its finding in the built site and passes after the fix',
    async (scenario) => {
        const { check, body, finding } = scenario;
        const { root, environment } = installedSandbox();
        const settings =
            'level' in scenario
                ? SITE_SETTINGS.replace('all', scenario.level) + REVIEWED_SELECTOR_SETTINGS
                : SITE_SETTINGS;
        const originalSettings = await readFile(join(root, 'gspot.toml'), 'utf8');
        const originalBuild = await readFile(join(root, 'build.js'), 'utf8');
        try {
            await createFileTree(root, { 'gspot.toml': settings, 'build.js': SITE_OUTPUT_BUILD });
            const applied = await runGspot(root, ['apply'], environment);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            const pages = join(root, 'pages');
            await createFileTree(pages, {
                ...('files' in scenario ? scenario.files : {}),
                'index.html': `${SITE_PAGE_HEAD}${body}</body></html>`,
                'style.css': check === 'site/purgecss' ? USED_SELECTOR_CSS : '.unused { color: red; }',
            });
            const failed = await spawnGspot(root, ['check', '--only', check, '--json'], environment);
            expect(failed.code, failed.stdout + failed.stderr).toBe(1);
            expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap((result) => result.findings)).toMatchObject(
                check === 'site/purgecss'
                    ? [finding, { ...finding, message: 'No built page uses the selector .unused:focus-visible.' }]
                    : [finding],
            );

            if (check === 'site/html-validate') {
                await writeFile(join(pages, 'index.html'), `${SITE_PAGE_HEAD}${body.repeat(400)}</body></html>`);
                const repeated = await spawnGspot(
                    root,
                    ['check', '--only', 'site/html-validate', '--json'],
                    environment,
                );
                expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
                const large = (JSON.parse(repeated.stdout) as RunReport).checks.flatMap((result) => result.findings);
                expect({ count: large.length, last: large.at(-1) }).toMatchObject({ count: 400, last: finding });
            }
            if ('files' in scenario)
                await writeFile(join(pages, 'orphan.html'), scenario.files['orphan.html'].replace('#missing', '#good'));
            await writeFile(
                join(pages, 'index.html'),
                `${SITE_PAGE_HEAD}${check === 'site/purgecss' ? USED_SELECTOR_BODY : ''}<p class="unused">Example</p></body></html>`,
            );
            const passed = await spawnGspot(root, ['check', '--only', check, '--json'], environment);
            expect(passed.code, passed.stdout + passed.stderr).toBe(0);
            expect((JSON.parse(passed.stdout) as RunReport).checks.flatMap((result) => result.findings)).toStrictEqual(
                [],
            );
        } finally {
            await writeFile(join(root, 'gspot.toml'), originalSettings);
            await writeFile(join(root, 'build.js'), originalBuild);
            await rm(join(root, 'pages'), { recursive: true, force: true });
            const restored = await spawnGspot(root, ['apply'], environment);
            expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        }
    },
);

for (const repository of BUILT_HTML_SITES)
    test(`a built HTML ignore stays inside its own site with ${repository.name}`, async () => {
        const { root, environment } = installedSandbox();
        const originalSettings = await readFile(join(root, 'gspot.toml'), 'utf8');
        const originalPage = await readFile(join(root, 'index.html'), 'utf8');
        const settings = settingsText(repository.configurations, { level: 'all', tables: TWO_SITE_SCOPES });
        try {
            await createFileTree(root, {
                'gspot.toml': settings,
                ...repository.files,
                'app/build.mjs': COPY_PAGE_BUILD,
                'app/page.html': MISSING_ALT_PAGE,
                'other/build.mjs': COPY_PAGE_BUILD,
                'other/page.html': MISSING_ALT_PAGE,
            });
            const applied = await spawnGspot(root, ['apply'], environment);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            const appliedSettings = await readFile(join(root, 'gspot.toml'), 'utf8');
            const checked = await spawnGspot(root, ['check', '--json', '--only', 'site/html-validate'], environment);
            expect(checked.code, checked.stdout + checked.stderr).toBe(1);
            expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
                { scope: 'app', status: 'passed', findings: [] },
                {
                    scope: 'other',
                    status: 'failed',
                    findings: [containing({ file: 'other/dist/index.html', line: 7, rule: 'wcag/h37' })],
                },
            ]);
            expect(await pathExists(join(root, '.gspot/config/html-validate-built.json'))).toBe(false);
            await writeFile(join(root, 'other/page.html'), ALT_TEXT_PAGE);
            const corrected = await spawnGspot(root, ['check', '--json', '--only', 'site/html-validate'], environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
                { scope: 'app', status: 'passed', findings: [] },
                { scope: 'other', status: 'passed', findings: [] },
            ]);
            expect(await readFile(join(root, 'gspot.toml'), 'utf8')).toBe(appliedSettings);
            for (const scope of ['app', 'other'])
                expect(await readFile(join(root, `${scope}/build.mjs`), 'utf8')).toBe(COPY_PAGE_BUILD);
        } finally {
            await writeFile(join(root, 'gspot.toml'), originalSettings);
            await writeFile(join(root, 'index.html'), originalPage);
            await rm(join(root, 'app'), { recursive: true, force: true });
            await rm(join(root, 'other'), { recursive: true, force: true });
            const restored = await spawnGspot(root, ['apply'], environment);
            expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        }
    });
