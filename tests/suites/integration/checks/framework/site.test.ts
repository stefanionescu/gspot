import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { SITE_SANDBOX } from '#tests/config/site.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { applySandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    OUTPUT_CASES,
    ALT_TEXT_PAGE,
    TWO_SITE_TABLES,
    BUILT_HTML_SITES,
    MISSING_ALT_PAGE,
} from '#tests/config/integration/checks/framework/site.ts';

const installedSandbox = shareInstalledSandbox(SITE_SANDBOX);

test.each([...OUTPUT_CASES])(
    '$check reports its finding in the built site and passes after the fix: $name',
    async (scenario) => {
        const { check, level, tables, files, findings, corrected } = scenario;
        const { root } = installedSandbox();
        const settings = buildSandboxSettings(['site'], {
            level,
            tables: `[site]\nbuild_command = ${JSON.stringify(buildProgramCommand('fakes/site-build', '--copy', 'pages=dist'))}\n${tables}`,
        });
        await using _sourceChange = await applySandboxChanges(installedSandbox(), {
            files: { 'gspot.toml': settings, ...files },
        });

        const fileUrl = isWindows ? 'file:///' : 'file://';
        const failed = parseCheckReport(await spawnGspot(root, ['check', '--only', check, '--json']));
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(
            failed.report.checks
                .flatMap((result) => result.findings)
                .map((finding) => ({ ...finding, message: finding.message.replaceAll(fileUrl, '{file-url}') })),
        ).toMatchObject([...findings]);
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
    },
);

test('HTML Validate reports all 400 missing alt attributes in a built page', async () => {
    const { root } = installedSandbox();
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['site'], {
                level: 'all',
                tables: `[site]\nbuild_command = ${JSON.stringify(buildProgramCommand('fakes/site-build', '--copy', 'pages=dist'))}\n`,
            }),
            'pages/index.html': `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body>${'<img src="image.png">'.repeat(400)}</body></html>`,
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
