import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { createFileTree, testdir } from 'testdirs';
import { symlinkSync } from 'node:fs';
import { readRepository } from '#cli/repository/tree.ts';
import { collectCarried } from '#cli/adoption/collect.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import type { ExistingTooling } from '#cli/repository/existing-tooling.ts';

const tooling: ExistingTooling = {
    configs: [{ tool: 'ruff', check: 'python/ruff', path: 'backend/ruff.toml', carries: 'rules-table' as const }],
    hooks: [],
    ci: [],
    agentFiles: [],
    rulesDirectories: [],
    lintFolders: [],
    lintOnlyManifests: [],
    runner: 'none',
};

test.each(['per-file-ignores', 'extend-per-file-ignores'])(
    'unrepresentable nested Ruff %s preserve the entire configuration without partial rule imports',
    async (key) => {
        await using sandbox = await testdir();
        for (const pattern of ['!tests/*.py', '../outside.py', '/outside.py', 'C:outside.py']) {
            const original = stringify({ lint: { ignore: ['F401'], [key]: { [pattern]: ['E401'] } } });
            await Bun.write(join(sandbox.path, 'backend/ruff.toml'), original);
            const carried = await collectCarried(sandbox.path, tooling, new Set(['python']), []);
            expect(carried.unread.map((entry) => entry.path)).toStrictEqual(['backend/ruff.toml']);
            expect([...carried.tools.values()].flatMap((tool) => tool.ignores)).toStrictEqual([]);
            expect(carried.removed).toStrictEqual([]);
            expect(await Bun.file(join(sandbox.path, 'backend/ruff.toml')).text()).toBe(original);
        }
    },
);

test('Ruff adoption reads its declared pyproject table without retiring project metadata', async () => {
    await using sandbox = await testdir();
    const path = 'backend/pyproject.toml';
    const original = '[project]\nname = "example"\nversion = "0.1.0"\n[tool.ruff.lint]\nignore = ["F401"]\n';
    await createFileTree(sandbox.path, { [path]: original, 'backend/example.py': 'import os\n' });
    const repository = await readRepository(sandbox.path, [], [], []);
    const discovered = existingTooling(sandbox.path, repository.files, []);
    const carried = await collectCarried(sandbox.path, discovered, new Set(['python']), ['backend/example.py']);
    expect(carried.unread).toStrictEqual([]);
    expect(carried.removed).toStrictEqual([]);
    expect(carried.tools.get('ruff')?.ignores).toStrictEqual([
        { check: 'python/ruff', rule: 'F401', paths: ['backend/**'], reason: expect.any(String) },
    ]);
    expect(carried.retained).toStrictEqual([{ path, note: expect.stringContaining('tool.ruff') }]);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
    await Bun.write(join(sandbox.path, path), '[project]\nname = "example"\nversion = "0.1.0"\n');
    expect(existingTooling(sandbox.path, repository.files, []).configs).toStrictEqual([]);
});

test.each([
    ['missing', 'extend = "missing.toml"\n'],
    ['cycle', 'extend = "../backend/ruff.toml"\n'],
    ['unsupported setting', '[lint]\nselect = ["F"]\n'],
    ['escaping path', 'extend = "../../outside.toml"\n'],
    ['unrepresentable scope intersection', '[lint.extend-per-file-ignores]\n"../**/*.py" = ["F401"]\n'],
])('Ruff inheritance with %s preserves the child without partial imports', async (_, parent) => {
    await using sandbox = await testdir();
    const original = 'extend = "../config/base.toml"\n[lint]\nignore = ["F401"]\n';
    await createFileTree(sandbox.path, { 'backend/ruff.toml': original, 'config/base.toml': parent });
    const carried = await collectCarried(sandbox.path, tooling, new Set(['python']), []);
    expect(carried.unread.map(({ path }) => path)).toStrictEqual(['backend/ruff.toml']);
    expect(carried.tools.size).toBe(0);
    expect(carried.removed).toStrictEqual([]);
    expect(carried.retained).toStrictEqual([]);
    expect(await Bun.file(join(sandbox.path, 'backend/ruff.toml')).text()).toBe(original);
});

test('Ruff inheritance refuses an external symlink without adopting child exclusions', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    const original = 'extend = "base.toml"\n[lint]\nignore = ["F401"]\n';
    await createFileTree(sandbox.path, { 'backend/ruff.toml': original });
    await createFileTree(outside.path, { 'base.toml': '[lint]\nignore = ["E701"]\n' });
    symlinkSync(join(outside.path, 'base.toml'), join(sandbox.path, 'backend/base.toml'));
    const carried = await collectCarried(sandbox.path, tooling, new Set(['python']), []);
    expect(carried.unread.map(({ path }) => path)).toStrictEqual(['backend/ruff.toml']);
    expect(carried.tools.size).toBe(0);
    expect(carried.removed).toStrictEqual([]);
    expect(await Bun.file(join(sandbox.path, 'backend/ruff.toml')).text()).toBe(original);
    expect(await Bun.file(join(outside.path, 'base.toml')).text()).toBe('[lint]\nignore = ["E701"]\n');
});

test('overlapping Ruff configurations cannot turn a parent exception into a child exemption', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'ruff.toml': '[lint]\nignore = ["F401"]\n',
        'backend/ruff.toml': '[lint]\nignore = ["E401"]\n',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const discovered = existingTooling(sandbox.path, repository.files, []);
    const carried = await collectCarried(sandbox.path, discovered, new Set(['python']), []);
    expect(carried.unread.map((entry) => entry.path)).toStrictEqual(['ruff.toml']);
    expect(carried.tools.size).toBe(0);
    expect(carried.removed).toStrictEqual([]);
    expect(await Bun.file(join(sandbox.path, 'ruff.toml')).text()).toBe('[lint]\nignore = ["F401"]\n');
    expect(await Bun.file(join(sandbox.path, 'backend/ruff.toml')).text()).toBe('[lint]\nignore = ["E401"]\n');
});
