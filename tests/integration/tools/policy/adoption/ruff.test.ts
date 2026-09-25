import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import { expect, test } from 'bun:test';
import { realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stringify } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';

import { collectCarried } from '#cli/policy/adoption/collect.ts';

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
    expect(carried.unread).toStrictEqual([]);
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
    const config = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    }).files.find((file) => file.path === '.gspot/config/ruff.toml')!;
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
    expect(findings.map(({ filename }) => relative(realpathSync(sandbox.path), filename)).sort()).toStrictEqual([
        'backend/kept.py',
        'ignored.py',
    ]);
    for (const path of ['backend/kept.py', 'ignored.py']) await Bun.write(join(sandbox.path, path), 'pass\n');
    const corrected = run();
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
});

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
    expect(carried.unread).toStrictEqual([]);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        stringify({ version: 1, configurations: ['python'], ignore: carried.tools.get('ruff')!.ignores }),
    );
    const session = await openSession(sandbox.path);
    const config = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    }).files.find((file) => file.path === '.gspot/config/ruff.toml')!;
    await Bun.write(join(sandbox.path, config.path), config.content);
    const after = run(config.path);
    expect(after.exitCode, after.stderr.toString()).toBe(1);
    const diagnostics = (result: ReturnType<typeof run>) =>
        (JSON.parse(result.stdout.toString()) as { filename: string; code: string }[]).map(({ filename, code }) => ({
            path: relative(realpathSync(sandbox.path), filename),
            code,
        }));
    expect(diagnostics(before)).toStrictEqual([{ path: 'backend/kept.py', code: 'F401' }]);
    expect(diagnostics(after)).toStrictEqual(diagnostics(before));
    await Bun.write(join(sandbox.path, 'backend/kept.py'), 'pass\n');
    const corrected = run(config.path);
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'backend/ruff.toml')).text()).toBe(original);
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
    expect(carried.unread).toStrictEqual([]);
    expect(carried.removed.map(({ path }) => path)).toStrictEqual(['backend/ruff.toml']);
    expect(carried.retained.map(({ path }) => path).sort()).toStrictEqual([
        'config/base.toml',
        'config/pyproject.toml',
    ]);
    expect([...carried.observed.keys()].sort()).toStrictEqual(Object.keys(originals).sort());
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        stringify({ version: 1, configurations: ['python'], ignore: carried.tools.get('ruff')!.ignores }),
    );
    const renderSession1 = await openSession(sandbox.path);
    const config = emitAll(renderSession1.policyFiles.policy, renderSession1.repository, renderSession1.scopes, {
        version: renderSession1.version,
        packageManager: renderSession1.packageManager,
    }).files.find((file) => file.path === '.gspot/config/ruff.toml')!;
    await Bun.write(join(sandbox.path, config.path), config.content);
    const after = run(config.path);
    expect(after.exitCode, after.stderr.toString()).toBe(1);
    const diagnostics = (result: ReturnType<typeof run>) =>
        (JSON.parse(result.stdout.toString()) as { filename: string; code: string }[]).map(({ filename, code }) => ({
            path: relative(realpathSync(sandbox.path), filename),
            code,
        }));
    expect(diagnostics(before)).toStrictEqual([
        { path: 'backend/elsewhere/kept.py', code: 'F401' },
        { path: 'backend/parent.py', code: 'F401' },
    ]);
    expect(diagnostics(after)).toStrictEqual(diagnostics(before));
    await Bun.write(join(sandbox.path, 'backend/parent.py'), 'pass\n');
    await Bun.write(join(sandbox.path, 'backend/elsewhere/kept.py'), 'pass\n');
    const corrected = run(config.path);
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
    for (const [path, original] of Object.entries(originals))
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
});
