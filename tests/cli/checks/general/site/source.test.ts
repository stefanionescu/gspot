import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { unlink, readFile } from 'node:fs/promises';
import { toolPin } from '#cli/configurations/pins.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { checkOutRevision } from '#cli/execution/copy/revision.ts';
import { svgo, deadAssets, webManifest } from '#cli/checks/general/site/source.ts';
import { ORIGINAL_SVG, SVG_SAVING_CASES, INVALID_WEB_MANIFESTS } from '#tests/config/cli/checks/general/site/source.ts';

test.each(['assets', 'public', 'static'])(
    'scoped %s assets retain their tracked outside references',
    async (folder) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy([], { level: 'all', tables: '[scope.docs]\nconfigurations = ["site"]\n' }),
            'README.md': `![Logo](docs/${folder}/logo.svg#light)\n![Other logo](other/${folder}/unused.svg)\n`,
            [`docs/${folder}/logo.svg`]: '<svg/>',
            [`docs/${folder}/unused.svg`]: '<svg/>',
            [`other/${folder}/unused.svg`]: '<svg/>',
        });
        commitAll(sandbox.path);
        const input = buildCheckInput(await openSession(sandbox.path), 'site/dead-assets', { scope: 'docs' });
        expect(deadAssets(input)).toMatchObject([
            { file: `docs/${folder}/unused.svg`, line: 1, check: 'site/dead-assets', rule: 'dead-asset' },
        ]);
    },
);

test('asset references read staged bytes without borrowing an unstaged README or an untracked consumer', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy([], { level: 'all', tables: '[scope.docs]\nconfigurations = ["site"]\n' }),
        'README.md': '![Logo](docs/assets/logo.svg)\n',
        'docs/assets/logo.svg': '<svg/>',
        'docs/assets/unused.svg': '<svg/>',
    });
    commitAll(sandbox.path);
    await createFileTree(sandbox.path, {
        'README.md': '![Unused](docs/assets/unused.svg)\n',
        'untracked.md': '![Unused](docs/assets/unused.svg)\n',
    });
    await checkOutRevision(sandbox.path, { kind: 'index' }, async (root) => {
        const input = buildCheckInput(await openSession(root), 'site/dead-assets', { scope: 'docs' });
        expect(deadAssets(input)).toMatchObject([{ file: 'docs/assets/unused.svg', rule: 'dead-asset' }]);
    });
    expect(await readFile(join(sandbox.path, 'README.md'), 'utf8')).toBe('![Unused](docs/assets/unused.svg)\n');
});

test('a site without Git keeps its local references and reports an unused asset', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['site'], { level: 'all' }),
        'index.html': '<img src="assets/logo.svg">',
        'assets/logo.svg': '<svg/>',
        'assets/unused.svg': '<svg/>',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'site/dead-assets');
    expect(input.index).toStrictEqual([]);
    expect(deadAssets(input)).toMatchObject([{ file: 'assets/unused.svg', rule: 'dead-asset' }]);
});

test.each(['astro', 'vue', 'svelte', 'jsx', 'tsx'])('a %s component names its asset', async (suffix) => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['site'], { level: 'all' }),
        [`Logo.${suffix}`]: '<img src="assets/logo.svg" />',
        'assets/logo.svg': '<svg/>',
        'assets/unused.svg': '<svg/>',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'site/dead-assets');
    expect(deadAssets(input)).toMatchObject([{ file: 'assets/unused.svg', rule: 'dead-asset' }]);
});

test('an unstaged deletion removes the tracked outside reference without failing the asset check', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy([], { level: 'all', tables: '[scope.docs]\nconfigurations = ["site"]\n' }),
        'README.md': '![Logo](docs/assets/logo.svg)\n',
        'docs/assets/logo.svg': '<svg/>',
    });
    commitAll(sandbox.path);
    await unlink(join(sandbox.path, 'README.md'));
    const input = buildCheckInput(await openSession(sandbox.path), 'site/dead-assets', { scope: 'docs' });
    expect(input.index.map((entry) => entry.path)).toContain('README.md');
    expect(deadAssets(input)).toMatchObject([{ file: 'docs/assets/logo.svg', rule: 'dead-asset' }]);
});

test.each(INVALID_WEB_MANIFESTS)('malformed web manifest %s produces a parse finding', async (source) => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['site']),
        'site.webmanifest': source,
    });
    const findings = webManifest(buildCheckInput(await openSession(sandbox.path), 'site/webmanifest'));
    expect(findings).toMatchObject([{ check: 'site/webmanifest', file: 'site.webmanifest', line: 1, rule: 'parse' }]);
});

test('a valid web manifest reports missing names and icons and passes after the fix', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['site']),
        'site.webmanifest': '{"icons": [{"src": "icon.png"}]}',
    });
    const rejected = webManifest(buildCheckInput(await openSession(sandbox.path), 'site/webmanifest'));
    expect(rejected).toMatchObject([
        { file: 'site.webmanifest', line: 1, rule: 'missing-name' },
        { file: 'site.webmanifest', line: 1, rule: 'icon' },
    ]);
    await createFileTree(sandbox.path, {
        'site.webmanifest': '{"name": "Example", "icons": [{"src": "icon.png"}]}',
        'icon.png': 'icon',
    });
    expect(webManifest(buildCheckInput(await openSession(sandbox.path), 'site/webmanifest'))).toStrictEqual([]);
});

test.each(SVG_SAVING_CASES)('SVG optimization $name', async ({ level, percent, saved, finding }) => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['site'], {
        level,
        tables:
            percent === undefined
                ? ''
                : `[tools.svgo]\nmin_saving_percent = ${String(percent)}\n[reasons]\n"tools.svgo.min_saving_percent" = "Required asset size threshold."\n`,
    });
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'icon.svg': ORIGINAL_SVG });
    const session = await openSession(sandbox.path);
    const pin = toolPin(session.manifests.values(), 'svgo');
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/.bin/svgo': 'fixture',
        '.gspot/node_modules/svgo/package.json': JSON.stringify({
            name: pin.installers['npm']!.name,
            version: pin.version,
        }),
    });
    using _executables = mockPinnedExecutables([pin]);
    using run = spyOn(processes, 'run').mockResolvedValue({
        code: 0,
        stdout: '<svg/>'.padEnd(Buffer.byteLength(ORIGINAL_SVG) - saved),
        stderr: '',
        missing: false,
        duration: 1,
    });
    const findings = await svgo(buildCheckInput(session, 'site/svgo'));
    expect(run.mock.calls.map(([, options]) => options.stdin)).toStrictEqual([ORIGINAL_SVG]);
    if (finding) {
        expect(findings).toMatchObject([{ file: 'icon.svg', rule: 'unoptimized' }]);
    } else expect(findings).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'icon.svg'), 'utf8')).toBe(ORIGINAL_SVG);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
});
