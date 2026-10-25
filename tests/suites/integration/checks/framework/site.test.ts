import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { applySandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { runCheckSample, expectedSummary } from '#tests/setup/cli/samples.ts';
import { buildSiteSettings, buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { SITE_SANDBOX, SITE_BUILD_ARGUMENTS } from '#tests/config/checks/framework/site/pages.ts';

import {
    OUTPUT_CASES,
    ALT_TEXT_PAGE,
    SITE_PAGE_HEAD,
    TWO_SITE_TABLES,
    BUILT_HTML_SITES,
    MISSING_ALT_PAGE,
} from '#tests/config/integration/checks/framework/site.ts';

const installedSandbox = shareInstalledSandbox(SITE_SANDBOX);

test('site/build reports a failed build and passes after the fix', async () => {
    const sample = {
        check: 'site/build',
        files: { 'gspot.toml': buildSiteSettings(buildProgramCommand('fakes/tool', '--exit', '1')) },
        expected: { file: '', rule: 'build', line: 1 },
        corrected: {
            files: {
                'gspot.toml': buildSiteSettings(buildProgramCommand('fakes/site-build', ...SITE_BUILD_ARGUMENTS)),
            },
        },
    };
    expect(await runCheckSample(installedSandbox(), sample)).toStrictEqual(expectedSummary(sample));
});

test.each([...OUTPUT_CASES])(
    '$check reports its finding in the built site and passes after the fix',
    async (scenario) => {
        const { check, level, tables, files, findings, corrected } = scenario;
        const { root } = installedSandbox();
        const settings = buildSiteSettings(buildProgramCommand('fakes/site-build', '--copy', 'pages=dist'), {
            level,
            tables,
        });
        await using _sourceChange = await applySandboxChanges(installedSandbox(), {
            files: { 'gspot.toml': settings, ...files },
        });

        const failed = parseCheckReport(await spawnGspot(root, ['check', '--only', check, '--json']));
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.report.checks.flatMap((result) => result.findings)).toMatchObject([...findings]);
        for (const [path, text] of Object.entries(corrected)) await writeFile(join(root, path), text);
        const passed = parseCheckReport(await spawnGspot(root, ['check', '--only', check, '--json']));
        expect(passed.code, passed.stdout + passed.stderr).toBe(0);
        expect(passed.report.checks.flatMap((result) => result.findings)).toStrictEqual([]);
    },
);

test.each([...BUILT_HTML_SITES])(
    'an html-validate ignore on app/** leaves the same finding in the other site, with $name',
    async (repository) => {
        const { root } = installedSandbox();
        const build = buildProgramCommand('fakes/site-build', '--copy', 'page.html=dist/index.html');
        const settings = buildSandboxSettings(repository.configurations, {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(build)}\n${TWO_SITE_TABLES}`,
        });
        await using _sourceChange = await applySandboxChanges(installedSandbox(), {
            files: {
                'gspot.toml': settings,
                ...repository.files,
                'app/page.html': MISSING_ALT_PAGE,
                'other/page.html': MISSING_ALT_PAGE,
            },
        });

        const appliedSettings = await readFile(join(root, 'gspot.toml'), 'utf8');
        const checked = parseCheckReport(await spawnGspot(root, ['check', '--json', '--only', 'site/html-validate']));
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        expect(checked.report.checks).toMatchObject([
            { scope: 'app', status: 'passed', findings: [] },
            {
                scope: 'other',
                status: 'failed',
                findings: [matchFields({ file: 'other/dist/index.html', line: 7, rule: 'wcag/h37' })],
            },
        ]);
        await writeFile(join(root, 'other/page.html'), ALT_TEXT_PAGE);
        const corrected = parseCheckReport(await spawnGspot(root, ['check', '--json', '--only', 'site/html-validate']));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([
            { scope: 'app', status: 'passed', findings: [] },
            { scope: 'other', status: 'passed', findings: [] },
        ]);
        expect(await readFile(join(root, 'gspot.toml'), 'utf8')).toBe(appliedSettings);
        expect(await readFile(join(root, 'app/page.html'), 'utf8')).toBe(MISSING_ALT_PAGE);
    },
);

test('HTML Validate reports all 400 missing alt attributes in a built page', async () => {
    const { root } = installedSandbox();
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSiteSettings(buildProgramCommand('fakes/site-build', '--copy', 'pages=dist')),
            'pages/index.html': `${SITE_PAGE_HEAD}${'<img src="image.png">'.repeat(400)}</body></html>`,
        },
    });

    const failed = parseCheckReport(await spawnGspot(root, ['check', '--only', 'site/html-validate', '--json']));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const findings = failed.report.checks.flatMap((result) => result.findings);
    expect({ count: findings.length, last: findings.at(-1) }).toMatchObject({
        count: 400,
        last: { file: 'dist/index.html', rule: 'wcag/h37', line: 1 },
    });
});
