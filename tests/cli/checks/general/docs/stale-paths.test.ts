import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { rmSync, mkdirSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { stalePaths } from '#cli/checks/general/docs.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { DOC_TASK_FILES, DOC_TASK_SCOPES, DOC_TASK_FINDINGS } from '#tests/config/cli/checks/general/docs.ts';

test('wildcard examples stay intact while emphasized literal paths remain checked', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.md': 'Outputs use `reports/report.*` or `src/*.ts`.\nSee **src/missing.ts**, *src/absent.ts*, and `src/gone.ts`.\n',
        'src/here.ts': '',
        'reports/README.md': '',
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
    const found = stalePaths(
        buildEngineInput(await openSession(sandbox.path), 'docs/stale-paths', { paths: ['a.md'] }),
    );
    expect(found.map(({ line, message: description }) => [line, description])).toStrictEqual([
        [2, 'src/missing.ts names no tracked file or folder.'],
        [2, 'src/absent.ts names no tracked file or folder.'],
        [2, 'src/gone.ts names no tracked file or folder.'],
    ]);
});

test('custom check identifiers resolve while undefined checks remain findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.md': 'Run `tests/coverage` and `tests/missing`.\n',
        'tests/example.ts': '',
    });
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        stringify({
            level: 'all',
            configurations: ['docs'],
            check: [{ name: 'tests/coverage', command: ['true'], paths: ['tests/**'], stage: 'manual' }],
        }),
    );
    const input = buildEngineInput(await openSession(sandbox.path), 'docs/stale-paths', { paths: ['a.md'] });
    expect(stalePaths(input).map(({ message: description }) => description)).toStrictEqual([
        'tests/missing names no tracked file or folder.',
    ]);
});

test('mise task aliases resolve while undefined aliases remain findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.md': 'Run `mise run compile`, `mise run verify`, `mise run validate`, and `mise run absent`.\n',
        'mise.toml':
            '[tasks.build]\nalias = "compile"\nrun = "true"\n[tasks.test]\nalias = ["verify", "validate"]\nrun = "true"\n',
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
    const found = stalePaths(
        buildEngineInput(await openSession(sandbox.path), 'docs/stale-paths', { paths: ['a.md'] }),
    );
    expect(found.map(({ message: description }) => description)).toStrictEqual([
        'mise run absent names no task or script.',
    ]);
});

test('tasks in shared mise configuration paths resolve without reading legacy tool versions as TOML', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.md': 'Run `mise run config-task`, `mise run local-task`, `mise run included-task`, and `mise run absent`.\n',
        '.mise/config.toml': '[tasks.config-task]\nrun = "true"\n',
        'mise.local.toml': '[tasks.local-task]\nrun = "true"\n',
        '.mise/conf.d/project.toml': '[tasks.included-task]\nrun = "true"\n',
        '.tool-versions': 'node 22\n',
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
    const found = stalePaths(
        buildEngineInput(await openSession(sandbox.path), 'docs/stale-paths', { paths: ['a.md'] }),
    );
    expect(found.map(({ message: description }) => description)).toStrictEqual([
        'mise run absent names no task or script.',
    ]);
});

test('document-relative references resolve without accepting nearby missing paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'docs/guide.md':
            'See `./examples/good.ts`, `../src/here.ts`, and `src/here.ts`.\nSee `./examples/gone.ts` and `../src/gone.ts`.\nSee `./src/here.ts` and `./missing/`.\n',
        'docs/examples/good.ts': '',
        'src/here.ts': '',
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
    const found = stalePaths(
        buildEngineInput(await openSession(sandbox.path), 'docs/stale-paths', { paths: ['docs/guide.md'] }),
    );
    expect(found.map(({ line, message: description }) => [line, description])).toStrictEqual([
        [2, './examples/gone.ts names no tracked file or folder.'],
        [2, '../src/gone.ts names no tracked file or folder.'],
        [3, './src/here.ts names no tracked file or folder.'],
        [3, './missing/ names no tracked file or folder.'],
    ]);
});

test('nested tilde text is excluded while shell paths remain checked', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.md': '> ~~~text\n> src/example.ts\n> ~~~~\n\n~~~sh\ncat src/missing.ts\n~~~\n',
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
    const found = stalePaths(
        buildEngineInput(await openSession(sandbox.path), 'docs/stale-paths', { paths: ['a.md'] }),
    );
    expect(found.map((finding) => [finding.line, finding.message])).toStrictEqual([
        [6, 'src/missing.ts names no tracked file or folder.'],
    ]);
});

test.each([
    ['package.json', '{broken'],
    ['mise.toml', '[tasks'],
])('malformed %s reports its read failure instead of a missing task', async (path, text) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.md': 'Run `bun run build`.\n',
        [path]: path === 'package.json' ? '{}' : '',
    });
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
    const session = await openSession(sandbox.path);
    await Bun.write(join(sandbox.path, path), text);
    const selected = buildEngineInput(session, 'docs/stale-paths', { paths: ['a.md'] });
    expect(() => stalePaths(selected)).toThrow(`Cannot read task definitions from ${path}.`);
});

test('a directory at a task configuration path is an error, not absent configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'a.md': 'Run `bun run build`.\n', 'package.json': '{}' });
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['docs'], { level: 'all' }));
    const session = await openSession(sandbox.path);
    rmSync(join(sandbox.path, 'package.json'));
    mkdirSync(join(sandbox.path, 'package.json'));
    const selected = buildEngineInput(session, 'docs/stale-paths', { paths: ['a.md'] });
    expect(() => stalePaths(selected)).toThrow('Cannot read task definitions from package.json.');
});

test.each(['recommended', 'all'] as const)(
    '%s validates documented tasks against their runner and nearest scoped definitions',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], { level, tables: DOC_TASK_SCOPES }),
            ...DOC_TASK_FILES,
        });
        const found = stalePaths(buildEngineInput(await openSession(sandbox.path), 'docs/stale-paths'));
        expect(found).toHaveLength(DOC_TASK_FINDINGS.length);
        for (const { command, ...place } of DOC_TASK_FINDINGS)
            expect(found).toContainEqual(
                containing({ ...place, rule: 'missing-task', message: textContaining(command) }),
            );
    },
);

test('a selected child document does not read unrelated or shadowed package scripts', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: DOC_TASK_SCOPES }),
        ...DOC_TASK_FILES,
    });
    const session = await openSession(sandbox.path);
    await createFileTree(sandbox.path, { 'package.json': '{broken', 'sibling/package.json': '{broken' });
    const input = buildEngineInput(session, 'docs/stale-paths', { paths: ['app/nested/guide.md'] });
    expect(stalePaths(input)).toStrictEqual([]);
});

test.each([
    ['app/package.json', '{broken'],
    ['app/mise.toml', '[tasks'],
])('a selected child document reports malformed %s at its actual owner', async (path, text) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: DOC_TASK_SCOPES }),
        ...DOC_TASK_FILES,
    });
    const session = await openSession(sandbox.path);
    await Bun.write(join(sandbox.path, path), text);
    const input = buildEngineInput(session, 'docs/stale-paths', { paths: ['app/nested/guide.md'] });
    expect(() => stalePaths(input)).toThrow(`Cannot read task definitions from ${path}.`);
});
