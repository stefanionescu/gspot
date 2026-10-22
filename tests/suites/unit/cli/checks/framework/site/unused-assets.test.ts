import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { unlink, readFile } from 'node:fs/promises';
import { commitAll } from '#tests/setup/system/git.ts';
import { copyRevision } from '#cli/runs/copy/revision.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runSandboxCheck, findBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { SCOPE_ASSET_FILES, ASSET_REFERENCE_CASES } from '#tests/config/checks/framework/site/unused-assets.ts';

/** Commit the asset files of one test in the docs site scope. */
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
    const root = await prepareAssetRepository(resources, SCOPE_ASSET_FILES);

    expect(await runSandboxCheck(root, 'site/unused-assets', { scope: 'docs' })).toMatchObject([
        { file: 'docs/assets/unused.svg', line: 1, check: 'site/unused-assets', rule: 'unused-asset' },
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
    using copy = await copyRevision(root, { kind: 'index' });
    const findings = await runSandboxCheck(copy.root, 'site/unused-assets', { scope: 'docs' });
    expect(findings).toMatchObject([{ file: 'docs/assets/unused.svg', rule: 'unused-asset' }]);
    expect(await readFile(join(root, 'README.md'), 'utf8')).toBe('![Unused](docs/assets/unused.svg)\n');
});

test.each([...ASSET_REFERENCE_CASES])(
    'a site without Git keeps the asset that %s names and reports an unused asset',
    async (file, text) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['site'], { level: 'all' }),
            [file]: text,
            'assets/logo.svg': '<svg/>',
            'assets/unused.svg': '<svg/>',
        });
        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'site/unused-assets');
        expect(session.repository.index).toStrictEqual([]);
        expect(await findBuiltInCheck('site/unused-assets')(session, input)).toMatchObject([
            { file: 'assets/unused.svg', rule: 'unused-asset' },
        ]);
    },
);

test('an unstaged deletion removes the reference without failing the asset check', async () => {
    await using resources = new AsyncDisposableStack();
    const root = await prepareAssetRepository(resources, {
        'README.md': '![Logo](docs/assets/logo.svg)\n',
        'docs/assets/logo.svg': '<svg/>',
    });
    await unlink(join(root, 'README.md'));
    const session = await openSession(root);
    const input = planSandboxCheck(session, 'site/unused-assets', { scope: 'docs' });
    expect(session.repository.index.map((entry) => entry.path)).toContain('README.md');
    expect(await findBuiltInCheck('site/unused-assets')(session, input)).toMatchObject([
        { file: 'docs/assets/logo.svg', rule: 'unused-asset' },
    ]);
});
