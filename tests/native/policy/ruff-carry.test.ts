import { readRepository } from '#cli/repository/tree.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import { join, relative } from 'node:path';
import { realpathSync, symlinkSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { stringify } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';
import { collectCarried } from '#cli/lifecycle/takeover.ts';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';
import type { ExistingTooling } from '#cli/types/repository.ts';

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

test('adopted Ruff basename and directory selectors retain their scope in pinned native diagnostics', async () => {
    await using sandbox = await testdir();
    const paths = [
        'ignored.py',
        'backend/ignored.py',
        'backend/deep/ignored.py',
        'backend/tests/deep/example.py',
        'backend/kept.py',
    ];
    await createFileTree(sandbox.path, {
        'backend/ruff.toml': '[lint.per-file-ignores]\n"ignored.py" = ["F"]\n"tests/*.py" = ["F401"]\n',
        ...Object.fromEntries(paths.map((path) => [path, 'import os\n'])),
    });
    const carried = await collectCarried(sandbox.path, tooling, new Set(['python']), paths);
    expect(carried.unread).toEqual([]);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        stringify({
            version: 1,
            configurations: ['python'],
            ignore: [...carried.tools.values()].flatMap((tool) => tool.ignores),
        }),
    );
    const session = await openSession(sandbox.path);
    const version = Bun.spawnSync(['ruff', '--version'], { stdout: 'pipe', stderr: 'pipe' });
    expect(version.stdout.toString().trim()).toBe(
        `ruff ${session.manifests.get('python')!.tools.find((tool) => tool.name === 'ruff')!.version}`,
    );
    const config = emitAll(session).files.find((file) => file.path === '.gspot/config/ruff.toml')!;
    await Bun.write(join(sandbox.path, config.path), config.content);
    const run = () =>
        Bun.spawnSync(
            [
                'ruff',
                'check',
                '--config',
                config.path,
                '--select',
                'F401',
                '--no-cache',
                '--output-format',
                'json',
                ...paths,
            ],
            { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' },
        );
    const failed = run();
    expect(failed.exitCode, failed.stderr.toString()).toBe(1);
    const findings = JSON.parse(failed.stdout.toString()) as { filename: string }[];
    expect(findings.map(({ filename }) => relative(realpathSync(sandbox.path), filename)).sort()).toEqual([
        'backend/kept.py',
        'ignored.py',
    ]);
    for (const path of ['backend/kept.py', 'ignored.py']) await Bun.write(join(sandbox.path, path), 'pass\n');
    const corrected = run();
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
});

test.each(['per-file-ignores', 'extend-per-file-ignores'])(
    'unrepresentable nested Ruff %s preserve the entire configuration without partial rule imports',
    async (key) => {
        await using sandbox = await testdir();
        for (const pattern of ['!tests/*.py', '../outside.py', '/outside.py', 'C:outside.py']) {
            const original = stringify({ lint: { ignore: ['F401'], [key]: { [pattern]: ['E401'] } } });
            await Bun.write(join(sandbox.path, 'backend/ruff.toml'), original);
            const carried = await collectCarried(sandbox.path, tooling, new Set(['python']), []);
            expect(carried.unread.map((entry) => entry.path)).toEqual(['backend/ruff.toml']);
            expect([...carried.tools.values()].flatMap((tool) => tool.ignores)).toEqual([]);
            expect(carried.removed).toEqual([]);
            expect(await Bun.file(join(sandbox.path, 'backend/ruff.toml')).text()).toBe(original);
        }
    },
);

test('additive Ruff exclusions preserve native findings and combine rules for the same selector', async () => {
    await using sandbox = await testdir();
    const original =
        '[lint]\nignore = ["E701"]\nextend-ignore = ["E702"]\n[lint.per-file-ignores]\n"ignored.py" = ["E401", "I001"]\n[lint.extend-per-file-ignores]\n"ignored.py" = ["F401"]\n';
    const paths = ['backend/ignored.py', 'backend/kept.py', 'backend/statements.py'];
    await createFileTree(sandbox.path, {
        'backend/ruff.toml': original,
        'backend/ignored.py': 'import os, sys\n',
        'backend/kept.py': 'import os\n',
        'backend/statements.py': 'if True: print("one"); print("two")\n',
    });
    const run = (config: string) =>
        Bun.spawnSync(['ruff', 'check', '--config', config, '--no-cache', '--output-format', 'json', ...paths], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
    const before = run('backend/ruff.toml');
    expect(before.exitCode, before.stderr.toString()).toBe(1);
    const carried = await collectCarried(sandbox.path, tooling, new Set(['python']), paths);
    expect(carried.unread).toEqual([]);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        stringify({ version: 1, configurations: ['python'], ignore: carried.tools.get('ruff')!.ignores }),
    );
    const session = await openSession(sandbox.path);
    const config = emitAll(session).files.find((file) => file.path === '.gspot/config/ruff.toml')!;
    await Bun.write(join(sandbox.path, config.path), config.content);
    const after = run(config.path);
    expect(after.exitCode, after.stderr.toString()).toBe(1);
    const diagnostics = (result: ReturnType<typeof run>) =>
        (JSON.parse(result.stdout.toString()) as { filename: string; code: string }[]).map(({ filename, code }) => ({
            path: relative(realpathSync(sandbox.path), filename),
            code,
        }));
    expect(diagnostics(before)).toEqual([{ path: 'backend/kept.py', code: 'F401' }]);
    expect(diagnostics(after)).toEqual(diagnostics(before));
    await Bun.write(join(sandbox.path, 'backend/kept.py'), 'pass\n');
    const corrected = run(config.path);
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'backend/ruff.toml')).text()).toBe(original);
});

test('Ruff adoption reads its declared pyproject table without retiring project metadata', async () => {
    await using sandbox = await testdir();
    const path = 'backend/pyproject.toml';
    const original = '[project]\nname = "example"\nversion = "0.1.0"\n[tool.ruff.lint]\nignore = ["F401"]\n';
    await createFileTree(sandbox.path, { [path]: original, 'backend/example.py': 'import os\n' });
    const repository = await readRepository(sandbox.path, [], [], []);
    const discovered = existingTooling(sandbox.path, repository.files, []);
    const carried = await collectCarried(sandbox.path, discovered, new Set(['python']), ['backend/example.py']);
    expect(carried.unread).toEqual([]);
    expect(carried.removed).toEqual([]);
    expect(carried.tools.get('ruff')?.ignores).toEqual([
        { check: 'python/ruff', rule: 'F401', paths: ['backend/**'], reason: expect.any(String) },
    ]);
    expect(carried.retained).toEqual([{ path, note: expect.stringContaining('tool.ruff') }]);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
    await Bun.write(join(sandbox.path, path), '[project]\nname = "example"\nversion = "0.1.0"\n');
    expect(existingTooling(sandbox.path, repository.files, []).configs).toEqual([]);
});

test('Ruff inheritance retains native merges and each parent selector directory', async () => {
    await using sandbox = await testdir();
    const originals = {
        'config/pyproject.toml':
            '[project]\nname = "shared"\n[tool.ruff.lint]\nignore = ["E701"]\n[tool.ruff.lint.per-file-ignores]\n"parent.py" = ["F401"]\n[tool.ruff.lint.extend-per-file-ignores]\n"../backend/tests/*.py" = ["F401"]\n"elsewhere/*.py" = ["F401"]\n',
        'config/base.toml':
            'extend = "pyproject.toml"\n[lint]\nignore = ["E702"]\n[lint.extend-per-file-ignores]\n"../backend/tests/*.py" = ["E401"]\n',
        'backend/ruff.toml':
            'extend = "../config/base.toml"\n[lint.per-file-ignores]\n"ignored.py" = ["F401"]\n[lint.extend-per-file-ignores]\n"tests/*.py" = ["I001"]\n',
    };
    const paths = [
        'backend/elsewhere/kept.py',
        'backend/parent.py',
        'backend/ignored.py',
        'backend/tests/example.py',
        'backend/statements.py',
    ];
    await createFileTree(sandbox.path, {
        ...originals,
        'backend/elsewhere/kept.py': 'import os\n',
        'backend/parent.py': 'import os\n',
        'backend/ignored.py': 'import os\n',
        'backend/tests/example.py': 'import os, sys\n',
        'backend/statements.py': 'if True: print("one"); print("two")\n',
    });
    const run = (config?: string) =>
        Bun.spawnSync(
            [
                'ruff',
                'check',
                ...(config === undefined ? [] : ['--config', config]),
                '--no-cache',
                '--output-format',
                'json',
                ...paths,
            ],
            { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' },
        );
    const before = run();
    expect(before.exitCode, before.stderr.toString()).toBe(1);
    const carried = await collectCarried(sandbox.path, tooling, new Set(['python']), paths);
    expect(carried.unread).toEqual([]);
    expect(carried.removed.map(({ path }) => path)).toEqual(['backend/ruff.toml']);
    expect(carried.retained.map(({ path }) => path).sort()).toEqual(['config/base.toml', 'config/pyproject.toml']);
    expect([...carried.observed.keys()].sort()).toEqual(Object.keys(originals).sort());
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        stringify({ version: 1, configurations: ['python'], ignore: carried.tools.get('ruff')!.ignores }),
    );
    const config = emitAll(await openSession(sandbox.path)).files.find((file) => file.path === '.gspot/config/ruff.toml')!;
    await Bun.write(join(sandbox.path, config.path), config.content);
    const after = run(config.path);
    expect(after.exitCode, after.stderr.toString()).toBe(1);
    const diagnostics = (result: ReturnType<typeof run>) =>
        (JSON.parse(result.stdout.toString()) as { filename: string; code: string }[]).map(({ filename, code }) => ({
            path: relative(realpathSync(sandbox.path), filename),
            code,
        }));
    expect(diagnostics(before)).toEqual([
        { path: 'backend/elsewhere/kept.py', code: 'F401' },
        { path: 'backend/parent.py', code: 'F401' },
    ]);
    expect(diagnostics(after)).toEqual(diagnostics(before));
    await Bun.write(join(sandbox.path, 'backend/parent.py'), 'pass\n');
    await Bun.write(join(sandbox.path, 'backend/elsewhere/kept.py'), 'pass\n');
    const corrected = run(config.path);
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
    for (const [path, original] of Object.entries(originals))
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
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
    expect(carried.unread.map(({ path }) => path)).toEqual(['backend/ruff.toml']);
    expect(carried.tools.size).toBe(0);
    expect(carried.removed).toEqual([]);
    expect(carried.retained).toEqual([]);
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
    expect(carried.unread.map(({ path }) => path)).toEqual(['backend/ruff.toml']);
    expect(carried.tools.size).toBe(0);
    expect(carried.removed).toEqual([]);
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
    expect(carried.unread.map((entry) => entry.path)).toEqual(['ruff.toml']);
    expect(carried.tools.size).toBe(0);
    expect(carried.removed).toEqual([]);
    expect(await Bun.file(join(sandbox.path, 'ruff.toml')).text()).toBe('[lint]\nignore = ["F401"]\n');
    expect(await Bun.file(join(sandbox.path, 'backend/ruff.toml')).text()).toBe('[lint]\nignore = ["E401"]\n');
});
