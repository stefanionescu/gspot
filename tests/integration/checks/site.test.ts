import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { runCheckSample } from '#tests/setup/sample-checks.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { SITE_SANDBOX } from '#tests/data/checks/site/project.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';

import {
    SITE_CASES,
    SITE_SETTINGS,
    COPY_PAGE_BUILD,
    TWO_SITE_SCOPES,
    BUILT_HTML_SITES,
    SITE_OUTPUT_BUILD,
} from '#tests/data/checks/site/build.ts';
import {
    OUTPUT_CASES,
    ALT_TEXT_PAGE,
    SITE_PAGE_HEAD,
    MISSING_ALT_PAGE,
    USED_SELECTOR_CSS,
    USED_SELECTOR_BODY,
    REVIEWED_SELECTOR_SETTINGS,
} from '#tests/data/checks/site/built-pages.ts';

const installedSandbox = registerSharedSandbox(SITE_SANDBOX);

test.each([...SITE_CASES])('$check reports its finding and passes after the fix', async (entry) => {
    const { failed, passed } = await runCheckSample(installedSandbox(), entry, SITE_SANDBOX);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.filter(({ status }) => status !== 'passed')).toMatchObject([
        { check: entry.check, status: 'failed' },
    ]);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toContainEqual(
        matchFields({ check: entry.check, ...entry.expected }),
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
        await using _sourceChange = await updateSandbox(installedSandbox(), {
            check,
            files: {
                'gspot.toml': settings,
                'build.js': SITE_OUTPUT_BUILD,
                ...Object.fromEntries(
                    Object.entries('files' in scenario ? scenario.files : {}).map(([path, text]) => [
                        `pages/${path}`,
                        text,
                    ]),
                ),
                'pages/index.html': `${SITE_PAGE_HEAD}${body}</body></html>`,
                'pages/style.css': check === 'site/purgecss' ? USED_SELECTOR_CSS : '.unused { color: red; }',
            },
        });
        const applied = await spawnGspot(root, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const pages = join(root, 'pages');
        const failed = await spawnGspot(root, ['check', '--only', check, '--json'], environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap((result) => result.findings)).toMatchObject(
            check === 'site/purgecss'
                ? [finding, { ...finding, message: 'No built page uses the selector .unused:focus-visible.' }]
                : [finding],
        );

        if (check === 'site/html-validate') {
            await writeFile(join(pages, 'index.html'), `${SITE_PAGE_HEAD}${body.repeat(400)}</body></html>`);
            const repeated = await spawnGspot(root, ['check', '--only', 'site/html-validate', '--json'], environment);
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
        expect((JSON.parse(passed.stdout) as RunReport).checks.flatMap((result) => result.findings)).toStrictEqual([]);
    },
);

test.each([...BUILT_HTML_SITES])('a built HTML ignore stays inside its own site with $name', async (repository) => {
    const { root, environment } = installedSandbox();
    const settings = buildSettingsText(repository.configurations, { level: 'all', tables: TWO_SITE_SCOPES });
    await using _sourceChange = await updateSandbox(installedSandbox(), {
        check: 'site/html-validate',
        files: {
            'gspot.toml': settings,
            ...repository.files,
            'app/build.mjs': COPY_PAGE_BUILD,
            'app/page.html': MISSING_ALT_PAGE,
            'other/build.mjs': COPY_PAGE_BUILD,
            'other/page.html': MISSING_ALT_PAGE,
        },
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
            findings: [matchFields({ file: 'other/dist/index.html', line: 7, rule: 'wcag/h37' })],
        },
    ]);
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
});
