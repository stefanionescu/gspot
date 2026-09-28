import { stringify } from 'smol-toml';
import { realpathSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { join, relative } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { collectKept } from '#cli/policy/adoption/collect.ts';
import type { ExistingTooling } from '#cli/types/repository/repository.ts';

const tooling: ExistingTooling = {
    configs: [{ tool: 'ruff', check: 'python/ruff', path: 'backend/ruff.toml', keeps: 'rules-table' as const }],
    hooks: [],
    ci: [],
    agentFiles: [],
    rulesDirectories: [],
    lintFolders: [],
    lintOnlyManifests: [],
    runner: 'none',
};

// The findings ruff printed as JSON, with each file relative to the sandbox.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests build this fixture; inlining it puts a test over the line limit.
function diagnostics(
    root: string,
    result: Pick<Bun.SyncSubprocess<'pipe', 'pipe'>, 'stdout'>,
): { path: string; code: string }[] {
    return (JSON.parse(result.stdout.toString()) as { filename: string; code: string }[]).map(({ filename, code }) => ({
        path: relative(realpathSync(root), filename).replaceAll('\\', '/'),
        code,
    }));
}

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
    const kept = await collectKept(sandbox.path, tooling, new Set(['python']), paths);
    expect(kept.unread).toStrictEqual([]);
    const policy = {
        version: 1,
        kits: ['python'],
        ignore: [...kept.tools.values()].flatMap((tool) => tool.ignores),
    };
    await Bun.write(join(sandbox.path, 'gspot.toml'), stringify(policy));
    const session = await openSession(sandbox.path);
    const version = Bun.spawnSync(['ruff', '--version'], { stdout: 'pipe', stderr: 'pipe' });
    expect(version.stdout.toString().trim()).toBe(
        `ruff ${session.manifests.get('python')!.tools.find((tool) => tool.name === 'ruff')!.version!}`,
    );
    const config = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.find((file) => file.path === '.gspot/config/ruff.toml')!;
    await Bun.write(join(sandbox.path, config.path), config.content);
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests build this fixture; inlining it puts a test over the line limit.
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
    expect(
        findings
            .map(({ filename }) => relative(realpathSync(sandbox.path), filename).replaceAll('\\', '/'))
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['backend/kept.py', 'ignored.py']);
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
        'backend/statements.py': 'values = []\nif True: values.append(1); values.append(2)\n',
    });
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests build this fixture; inlining it puts a test over the line limit.
    const run = (config: string) =>
        Bun.spawnSync(['ruff', 'check', '--config', config, '--no-cache', '--output-format', 'json', ...paths], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
    const before = run('backend/ruff.toml');
    expect(before.exitCode, before.stderr.toString()).toBe(1);
    const kept = await collectKept(sandbox.path, tooling, new Set(['python']), paths);
    expect(kept.unread).toStrictEqual([]);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        stringify({ version: 1, kits: ['python'], ignore: kept.tools.get('ruff')!.ignores }),
    );
    const session = await openSession(sandbox.path);
    const config = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.find((file) => file.path === '.gspot/config/ruff.toml')!;
    await Bun.write(join(sandbox.path, config.path), config.content);
    const after = run(config.path);
    expect(after.exitCode, after.stderr.toString()).toBe(1);
    expect(diagnostics(sandbox.path, before)).toStrictEqual([{ path: 'backend/kept.py', code: 'F401' }]);
    expect(diagnostics(sandbox.path, after)).toStrictEqual(diagnostics(sandbox.path, before));
    await Bun.write(join(sandbox.path, 'backend/kept.py'), 'pass\n');
    const corrected = run(config.path);
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'backend/ruff.toml')).text()).toBe(original);
});

const INHERITED_FILES = {
    configs: {
        'config/pyproject.toml':
            '[project]\nname = "shared"\n[tool.ruff.lint]\nignore = ["E701"]\n[tool.ruff.lint.per-file-ignores]\n"parent.py" = ["F401"]\n[tool.ruff.lint.extend-per-file-ignores]\n"../backend/tests/*.py" = ["F401"]\n"elsewhere/*.py" = ["F401"]\n',
        'config/base.toml':
            'extend = "pyproject.toml"\n[lint]\nignore = ["E702"]\n[lint.extend-per-file-ignores]\n"../backend/tests/*.py" = ["E401"]\n',
        'backend/ruff.toml':
            'extend = "../config/base.toml"\n[lint.per-file-ignores]\n"ignored.py" = ["F401"]\n[lint.extend-per-file-ignores]\n"tests/*.py" = ["I001"]\n',
    },
    sources: {
        'backend/elsewhere/kept.py': 'import os\n',
        'backend/parent.py': 'import os\n',
        'backend/ignored.py': 'import os\n',
        'backend/tests/example.py': 'import os, sys\n',
        'backend/statements.py': 'values = []\nif True: values.append(1); values.append(2)\n',
    },
};

test('Ruff inheritance retains native merges and each parent selector directory', async () => {
    await using sandbox = await testdir();
    const paths = Object.keys(INHERITED_FILES.sources);
    await createFileTree(sandbox.path, { ...INHERITED_FILES.configs, ...INHERITED_FILES.sources });
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests build this fixture; inlining it puts a test over the line limit.
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
    const kept = await collectKept(sandbox.path, tooling, new Set(['python']), paths);
    expect(kept.unread).toStrictEqual([]);
    expect(kept.removed.map(({ path }) => path)).toStrictEqual(['backend/ruff.toml']);
    expect(kept.retained.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'config/base.toml',
        'config/pyproject.toml',
    ]);
    expect([...kept.read.keys()].toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        Object.keys(INHERITED_FILES.configs).toSorted((left, right) => left.localeCompare(right)),
    );
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        stringify({ version: 1, kits: ['python'], ignore: kept.tools.get('ruff')!.ignores }),
    );
    const session = await openSession(sandbox.path);
    const config = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.find((file) => file.path === '.gspot/config/ruff.toml')!;
    await Bun.write(join(sandbox.path, config.path), config.content);
    const after = run(config.path);
    expect(after.exitCode, after.stderr.toString()).toBe(1);
    expect(diagnostics(sandbox.path, before)).toStrictEqual([
        { path: 'backend/elsewhere/kept.py', code: 'F401' },
        { path: 'backend/parent.py', code: 'F401' },
    ]);
    expect(diagnostics(sandbox.path, after)).toStrictEqual(diagnostics(sandbox.path, before));
    await Bun.write(join(sandbox.path, 'backend/parent.py'), 'pass\n');
    await Bun.write(join(sandbox.path, 'backend/elsewhere/kept.py'), 'pass\n');
    const corrected = run(config.path);
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
    for (const [path, original] of Object.entries(INHERITED_FILES.configs))
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
});
