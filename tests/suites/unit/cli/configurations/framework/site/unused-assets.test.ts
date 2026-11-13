import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { GLOB_ASSET_CASES } from '#tests/config/configurations/framework.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

async function prepareAssetRepository(resources: AsyncDisposableStack, files: Record<string, string>): Promise<string> {
    const sandbox = resources.use(
        await testdir({
            'gspot.toml': buildSandboxSettings([], {
                level: 'all',
                scopes: [{ path: 'docs', configurations: ['site'] }],
            }),
            ...files,
        }),
    );
    commitAll(sandbox.path);
    return sandbox.path;
}

test("an asset in a scope's assets folder counts as used when a file outside the scope links to it", async () => {
    await using resources = new AsyncDisposableStack();
    const root = await prepareAssetRepository(resources, {
        'README.md': '![Logo](docs/assets/logo.svg#light)\n![Other logo](other/assets/unused.svg)\n',
        'docs/assets/logo.svg': '<svg/>',
        'docs/assets/unused.svg': '<svg/>',
        'other/assets/unused.svg': '<svg/>',
    });

    expect(await runSandboxCheck(root, 'site/unused-assets', { scope: 'docs' })).toStrictEqual([
        expect.objectContaining({ file: 'docs/assets/unused.svg', line: 1, rule: 'unused-asset' }),
    ]);
});

test('an asset that a package import alias names counts as used', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], { level: 'all' }),
        'package.json': '{ "imports": { "#site/*": "./src/*" } }\n',
        'src/components/Logo.astro': "---\nimport logo from '#site/assets/logo.svg';\n---\n<img src={logo.src} />\n",
        'src/assets/logo.svg': '<svg/>',
        'src/assets/unused.svg': '<svg/>',
    });
    expect(await runSandboxCheck(sandbox.path, 'site/unused-assets')).toMatchObject([
        { file: 'src/assets/unused.svg', rule: 'unused-asset' },
    ]);
});

test('an unstaged deletion removes the reference without failing the asset check', async () => {
    await using resources = new AsyncDisposableStack();
    const root = await prepareAssetRepository(resources, {
        'README.md': '![Logo](docs/assets/logo.svg)\n',
        'docs/assets/logo.svg': '<svg/>',
    });
    await unlink(join(root, 'README.md'));
    expect(await runSandboxCheck(root, 'site/unused-assets', { scope: 'docs' })).toMatchObject([
        { file: 'docs/assets/logo.svg', rule: 'unused-asset' },
    ]);
});

test('conventional assets pass and a nested asset needs its own path', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], { level: 'all' }),
        'public/favicon.ico': 'image',
        'public/apple-touch-icon.png': 'image',
        'public/a/logo.svg': '<svg/>',
        'public/b/logo.svg': '<svg/>',
        'page.mdx': '<img src="/a/logo.svg" />',
    });
    expect(await runSandboxCheck(sandbox.path, 'site/unused-assets')).toMatchObject([
        { file: 'public/b/logo.svg', rule: 'unused-asset' },
    ]);
});

test.each(GLOB_ASSET_CASES)('literal glob imports in $path retain matching assets', async ({ path, text, unused }) => {
    await using resources = new AsyncDisposableStack();
    const root = await prepareAssetRepository(resources, {
        [path]: text,
        'docs/assets/tools/logo.svg': '<svg/>',
        'docs/assets/tools/spare.svg': '<svg/>',
        'docs/assets/other.svg': '<svg/>',
    });
    const findings = await runSandboxCheck(root, 'site/unused-assets', { scope: 'docs' });
    expect(findings.map((finding) => finding.file)).toStrictEqual([...unused]);
});

test('an asset at the root that only a nested scope links is unused at the root', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], { level: 'all', scopes: [{ path: 'apps/backend' }] }),
        'assets/unused.png': new Uint8Array([0, 1, 2, 3]),
        'apps/backend/index.html': '<img alt="Backend diagram" src="/assets/unused.png">',
    });
    const root = await runSandboxCheck(sandbox.path, 'site/unused-assets', { scope: '' });
    expect(root.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'assets/unused.png', rule: 'unused-asset' },
    ]);
    expect(await runSandboxCheck(sandbox.path, 'site/unused-assets', { scope: 'apps/backend' })).toStrictEqual([]);
});
