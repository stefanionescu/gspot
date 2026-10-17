import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { unlink, readFile } from 'node:fs/promises';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { copyRevision } from '#cli/checks/run/copy/revision.ts';
import { CHECK_IMPLEMENTATIONS } from '#cli/checks/implementations.ts';
import { checkFindings, buildCheckInput } from '#tests/setup/check-input.ts';

test("an asset in a scope's assets folder counts as used when a file outside the scope links to it", async () => {
    await using resources = new AsyncDisposableStack();
    const root = await prepareAssetRepository(resources, {
        'README.md': '![Logo](docs/assets/logo.svg#light)\n![Other logo](other/assets/unused.svg)\n',
        'docs/assets/logo.svg': '<svg/>',
        'docs/assets/unused.svg': '<svg/>',
        'other/assets/unused.svg': '<svg/>',
    });

    expect(await checkFindings(root, 'site/unused-assets', { scope: 'docs' })).toMatchObject([
        { file: 'docs/assets/unused.svg', line: 1, check: 'site/unused-assets', rule: 'dead-asset' },
    ]);
});

test('unused-assets reads staged files, not an unstaged README or an untracked file', async () => {
    await using resources = new AsyncDisposableStack();
    const root = await prepareAssetRepository(resources, {
        'README.md': '![Logo](docs/assets/logo.svg)\n',
        'docs/assets/logo.svg': '<svg/>',
        'docs/assets/unused.svg': '<svg/>',
    });
    await createFileTree(root, {
        'README.md': '![Unused](docs/assets/unused.svg)\n',
        'untracked.md': '![Unused](docs/assets/unused.svg)\n',
    });
    const findings = await copyRevision(root, { kind: 'index' }, async (root) => {
        return await checkFindings(root, 'site/unused-assets', { scope: 'docs' });
    });
    expect(findings).toMatchObject([{ file: 'docs/assets/unused.svg', rule: 'dead-asset' }]);
    expect(await readFile(join(root, 'README.md'), 'utf8')).toBe('![Unused](docs/assets/unused.svg)\n');
});

test('a site without Git keeps its local references and reports an unused asset', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['site'], { level: 'all' }),
        'index.html': '\u003Cimg src="assets/logo.svg">',
        'assets/logo.svg': '<svg/>',
        'assets/unused.svg': '<svg/>',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'site/unused-assets');
    expect(input.index).toStrictEqual([]);
    expect(CHECK_IMPLEMENTATIONS['site/unused-assets'].check(input)).toMatchObject([
        { file: 'assets/unused.svg', rule: 'dead-asset' },
    ]);
});

test('a .tsx component names its asset', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['site'], { level: 'all' }),
        'Logo.tsx': '\u003Cimg src="assets/logo.svg" />',
        'assets/logo.svg': '<svg/>',
        'assets/unused.svg': '<svg/>',
    });

    expect(await checkFindings(sandbox.path, 'site/unused-assets')).toMatchObject([
        { file: 'assets/unused.svg', rule: 'dead-asset' },
    ]);
});

test('an unstaged deletion removes the reference without failing the asset check', async () => {
    await using resources = new AsyncDisposableStack();
    const root = await prepareAssetRepository(resources, {
        'README.md': '![Logo](docs/assets/logo.svg)\n',
        'docs/assets/logo.svg': '<svg/>',
    });
    await unlink(join(root, 'README.md'));
    const input = buildCheckInput(await openSession(root), 'site/unused-assets', { scope: 'docs' });
    expect(input.index.map((entry) => entry.path)).toContain('README.md');
    expect(CHECK_IMPLEMENTATIONS['site/unused-assets'].check(input)).toMatchObject([
        { file: 'docs/assets/logo.svg', rule: 'dead-asset' },
    ]);
});

/** Commit the asset files of one test in the docs site scope. */
async function prepareAssetRepository(resources: AsyncDisposableStack, files: Record<string, string>): Promise<string> {
    const sandbox = resources.use(
        await testdir({
            'gspot.toml': buildSettingsText([], {
                level: 'all',
                tables: '[[scope]]\npath = "docs"\nconfigurations = ["site"]\n',
            }),
            ...files,
        }),
    );
    commitAll(sandbox.path);
    return sandbox.path;
}
