import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { unlink, readFile } from 'node:fs/promises';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { fakeNpmTool } from '#tests/setup/fake-tool.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CHECK_FUNCTIONS } from '#cli/checks/built-in.ts';
import { processResult } from '#tests/setup/processes.ts';
import { mockPinnedExecutables } from '#tests/setup/pins.ts';
import { copyRevision } from '#cli/execution/copy/revision.ts';
import { checkFindings, buildCheckInput } from '#tests/setup/check-input.ts';

import {
    ORIGINAL_SVG,
    MANIFEST_LINKS,
    SVG_SAVING_CASES,
    INVALID_WEB_MANIFESTS,
} from '#tests/config/site/source-files.ts';

test("an asset in a scope's assets folder counts as used when a file outside the scope links to it", async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText([], {
            level: 'all',
            tables: '[[scope]]\npath = "docs"\nconfigurations = ["site"]\n',
        }),
        'README.md': '![Logo](docs/assets/logo.svg#light)\n![Other logo](other/assets/unused.svg)\n',
        'docs/assets/logo.svg': '<svg/>',
        'docs/assets/unused.svg': '<svg/>',
        'other/assets/unused.svg': '<svg/>',
    });
    commitAll(sandbox.path);

    expect(await checkFindings(sandbox.path, 'site/unused-assets', { scope: 'docs' })).toMatchObject([
        { file: 'docs/assets/unused.svg', line: 1, check: 'site/unused-assets', rule: 'dead-asset' },
    ]);
});

test('unused-assets reads staged files, not an unstaged README or an untracked file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText([], {
            level: 'all',
            tables: '[[scope]]\npath = "docs"\nconfigurations = ["site"]\n',
        }),
        'README.md': '![Logo](docs/assets/logo.svg)\n',
        'docs/assets/logo.svg': '<svg/>',
        'docs/assets/unused.svg': '<svg/>',
    });
    commitAll(sandbox.path);
    await createFileTree(sandbox.path, {
        'README.md': '![Unused](docs/assets/unused.svg)\n',
        'untracked.md': '![Unused](docs/assets/unused.svg)\n',
    });
    const findings = await copyRevision(sandbox.path, { kind: 'index' }, async (root) => {
        return await checkFindings(root, 'site/unused-assets', { scope: 'docs' });
    });
    expect(findings).toMatchObject([{ file: 'docs/assets/unused.svg', rule: 'dead-asset' }]);
    expect(await readFile(join(sandbox.path, 'README.md'), 'utf8')).toBe('![Unused](docs/assets/unused.svg)\n');
});

test('a site without Git keeps its local references and reports an unused asset', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['site'], { level: 'all' }),
        'index.html': '\u003Cimg src="assets/logo.svg">',
        'assets/logo.svg': '<svg/>',
        'assets/unused.svg': '<svg/>',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'site/unused-assets');
    expect(input.index).toStrictEqual([]);
    expect(CHECK_FUNCTIONS['site/unused-assets'](input)).toMatchObject([
        { file: 'assets/unused.svg', rule: 'dead-asset' },
    ]);
});

test('a .tsx component names its asset', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['site'], { level: 'all' }),
        'Logo.tsx': '\u003Cimg src="assets/logo.svg" />',
        'assets/logo.svg': '<svg/>',
        'assets/unused.svg': '<svg/>',
    });

    expect(await checkFindings(sandbox.path, 'site/unused-assets')).toMatchObject([
        { file: 'assets/unused.svg', rule: 'dead-asset' },
    ]);
});

test('an unstaged deletion removes the reference without failing the asset check', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText([], {
            level: 'all',
            tables: '[[scope]]\npath = "docs"\nconfigurations = ["site"]\n',
        }),
        'README.md': '![Logo](docs/assets/logo.svg)\n',
        'docs/assets/logo.svg': '<svg/>',
    });
    commitAll(sandbox.path);
    await unlink(join(sandbox.path, 'README.md'));
    const input = buildCheckInput(await openSession(sandbox.path), 'site/unused-assets', { scope: 'docs' });
    expect(input.index.map((entry) => entry.path)).toContain('README.md');
    expect(CHECK_FUNCTIONS['site/unused-assets'](input)).toMatchObject([
        { file: 'docs/assets/logo.svg', rule: 'dead-asset' },
    ]);
});

test.each([...INVALID_WEB_MANIFESTS])('malformed web manifest %s produces a parse finding', async (source) => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['site']),
        'site.webmanifest': source,
    });
    const findings = await checkFindings(sandbox.path, 'site/webmanifest');
    expect(findings).toMatchObject([{ check: 'site/webmanifest', file: 'site.webmanifest', line: 1, rule: 'parse' }]);
});

test('a valid web manifest reports missing names and icons and passes after the fix', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['site']),
        'site.webmanifest': '{"icons": [{"src": "icon.png"}]}',
    });
    const rejected = await checkFindings(sandbox.path, 'site/webmanifest');
    expect(rejected).toMatchObject([
        { file: 'site.webmanifest', line: 1, rule: 'missing-name' },
        { file: 'site.webmanifest', line: 1, rule: 'icon' },
    ]);
    await createFileTree(sandbox.path, {
        'site.webmanifest': '{"name": "Example", "icons": [{"src": "icon.png"}]}',
        'icon.png': 'icon',
    });
    expect(await checkFindings(sandbox.path, 'site/webmanifest')).toStrictEqual([]);
});

test.each([...SVG_SAVING_CASES])('SVG optimization $name', async (sample) => {
    const { percent, saved, finding } = sample;
    await using sandbox = await testdir();
    const settings = settingsText(['site'], {
        level: 'all',
        tables:
            percent === 0
                ? '[tools.svgo]\nmin_saving_percent = 0\n'
                : `[tools.svgo]\nmin_saving_percent = { value = ${String(percent)}, reason = "Required asset size limit." }\n`,
    });
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'icon.svg': ORIGINAL_SVG });
    const session = await openSession(sandbox.path);
    const pin = await fakeNpmTool(sandbox.path, 'svgo');
    await createFileTree(sandbox.path, {});
    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([pin]));
    using run = spyOn(processes, 'run').mockResolvedValue(
        processResult({ stdout: '<svg/>'.padEnd(Buffer.byteLength(ORIGINAL_SVG) - saved) }),
    );
    const findings = await checkFindings(session.root, 'site/svgo');
    expect(run.mock.calls.map(([, options]) => options.stdin)).toStrictEqual([ORIGINAL_SVG]);
    if (finding) {
        expect(findings).toMatchObject([{ file: 'icon.svg', rule: 'unoptimized' }]);
    } else expect(findings).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'icon.svg'), 'utf8')).toBe(ORIGINAL_SVG);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});

test('web manifests are found through HTML link tags, not by file name', async () => {
    await using sandbox = await testdir();
    const settings = settingsText(['site'], {
        level: 'all',
        tables: '[[scope]]\npath = "app"\nconfigurations = ["site"]\n',
    });
    await createFileTree(sandbox.path, { 'gspot.toml': settings });
    for (const scope of ['', 'app'])
        await createFileTree(sandbox.path, {
            [join(scope, 'index.html')]: MANIFEST_LINKS,
            [join(scope, 'config/manifest.json')]: '{',
            [join(scope, 'metadata/app manifest.json')]: '{"icons":[{"src":"icon.png"}]}',
        });
    for (const scope of ['', 'app']) {
        const path = scope === '' ? 'metadata/app manifest.json' : 'app/metadata/app manifest.json';
        const findings = await checkFindings(sandbox.path, 'site/webmanifest', { scope });
        expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
            { file: path, rule: 'missing-name' },
            { file: path, rule: 'icon' },
        ]);
        await createFileTree(sandbox.path, {
            [path]: '{"name":"Example","icons":[{"src":"icon.png"}]}',
            [join(scope, 'metadata/icon.png')]: 'icon',
        });
        expect(await checkFindings(sandbox.path, 'site/webmanifest', { scope })).toStrictEqual([]);
        expect(await readFile(join(sandbox.path, scope, 'config/manifest.json'), 'utf8')).toBe('{');
        expect(await readFile(join(sandbox.path, scope, 'index.html'), 'utf8')).toBe(MANIFEST_LINKS);
    }
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});
