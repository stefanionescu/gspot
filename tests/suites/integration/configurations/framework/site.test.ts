import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

const CORRECTED_INDEX_PAGE =
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p class="unused">Example</p></body></html>';

const TWO_SITE_TABLES = `[[ignore]]
check = "site/html-validate"
rule = "wcag/h37"
paths = ["app/**"]
reason = "Application alternative text is supplied by the rendering environment."
[[scope]]
path = "app"
configurations = ["site"]
site.build_folder = "dist"
[[scope]]
path = "other"
configurations = ["site"]
site.build_folder = "dist"
`;

const ALT_TEXT_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Example</title></head>
<body>
<main>
<h1>Example</h1>
<img src="logo.svg" alt="Example">
</main>
</body>
</html>
`;

const BUILT_HTML_SITES = [
    { name: 'a root HTML configuration', configurations: ['html'], files: { 'index.html': ALT_TEXT_PAGE } },
    { name: 'site-only child configurations', configurations: [], files: {} },
] as const;

const INDEX_LINK_FINDING = { check: 'site/lychee', file: 'dist/index.html', rule: 'ERROR', line: 1 } as const;

const SELECTOR_FINDING = {
    file: 'dist/style.css',
    rule: 'unused-selector',
    line: 1,
    message: 'No built page uses the selector .unused.',
} as const;

const OUTPUT_CASES = [
    {
        name: 'links',
        check: 'site/lychee',
        level: 'all',
        tables: '',
        files: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><a href="/missing.html">Missing</a></body></html>',
        },
        findings: [INDEX_LINK_FINDING],
        corrected: {
            'pages/index.html': CORRECTED_INDEX_PAGE,
        },
    },
    {
        name: 'fragments',
        check: 'site/lychee',
        level: 'all',
        tables: '',
        files: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><h1 id="good">Good</h1><a href="#good">Good</a><a href="#missing">Missing</a><a name="encoded id"></a><a href="#encoded%20id">Encoded</a></body></html>',
        },
        findings: [INDEX_LINK_FINDING],
        corrected: {
            'pages/index.html': CORRECTED_INDEX_PAGE,
        },
    },
    {
        name: 'public origins and orphan pages',
        check: 'site/lychee',
        level: 'all',
        tables: '',
        files: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p>Landing page</p></body></html>',
            'pages/sitemap.xml':
                '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n    <url><loc>https://example.test/</loc></url>\n    <url><loc>https://example.test/about.html</loc></url>\n</urlset>\n',
            'pages/orphan.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Orphan</title></head><body><h1 id="good">Good</h1><a href="https://example.test/orphan.html#missing">Missing</a><a href="https://example.test/orphan.html#good">Good</a></body></html>',
        },
        findings: [{ ...INDEX_LINK_FINDING, file: 'dist/orphan.html' }],
        corrected: {
            'pages/index.html': CORRECTED_INDEX_PAGE,
            'pages/orphan.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Orphan</title></head><body><h1 id="good">Good</h1><a href="https://example.test/orphan.html#good">Missing</a><a href="https://example.test/orphan.html#good">Good</a></body></html>',
        },
    },
    {
        name: 'selectors at level basic',
        check: 'site/purgecss',
        level: 'basic',
        tables: `
allowed_classes = { value = ["reviewed"], reason = "The script adds this reviewed class at runtime." }
`,
        files: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p class="print:hidden w-1/2 pagefind-ui__result">Example</p><script>element.classList.add("feedback", "show", "pagefind-ui__loading");</script></body></html>',
            'pages/style.css': String.raw`.print\:hidden { display: none; }.w-1\/2 { width: 50%; }.feedback.show { opacity: 1; }.pagefind-ui__result { color: blue; }.pagefind-ui__loading { opacity: 0.5; }.unused { color: red; }:focus-visible { outline: 3px solid blue; }.unused:focus-visible { color: red; }.reviewed:focus-visible { color: purple; }`,
        },
        findings: [
            SELECTOR_FINDING,
            {
                file: 'dist/style.css',
                rule: 'unused-selector',
                line: 1,
                message: 'No built page uses the selector .unused:focus-visible.',
            },
        ],
        corrected: {
            'pages/index.html':
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p class="print:hidden w-1/2 pagefind-ui__result">Example</p><script>element.classList.add("feedback", "show", "pagefind-ui__loading");</script><p class="unused">Example</p></body></html>',
        },
    },
] as const;

const MISSING_ALT_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Example</title></head>
<body>
<main>
<h1>Example</h1>
<img src="logo.svg">
</main>
</body>
</html>
`;

const STATIC_SITE_FILES = {
    '.gitignore': 'node_modules\ndist\n',
    'package.json': `{
    "name": "example",
    "version": "1.0.0",
    "private": true,
    "packageManager": "bun@1.4.2",
    "description": "A test site.",
    "type": "module",
    "engines": {
        "node": ">=24.2.0"
    },
    "devDependencies": {
        "@types/node": "22.18.6"
    }
}
`,
} as const;

const SITE_SANDBOX = {
    configurations: ['site'],

    files: STATIC_SITE_FILES,
} as const;

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
        await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
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
        await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
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
    const buildCommand = buildProgramCommand('fakes/site-build', '--copy', 'pages=dist');
    await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['site'], {
                level: 'all',
                tables: `[site]\nbuild_command = ${JSON.stringify(buildCommand)}\n`,
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
