import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { checkInput } from '#tests/support/cli/input.ts';
import { stalePaths } from '#cli/checks/general/docs/stale-paths.ts';

test('wildcard examples stay intact while emphasized literal paths remain checked', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.md': 'Outputs use `reports/report.*` or `src/*.ts`.\nSee **src/missing.ts**, *src/absent.ts*, and `src/gone.ts`.\n',
        'src/here.ts': '',
        'reports/README.md': '',
    });
    const found = stalePaths(await checkInput(sandbox.path, 'integrity/stale-paths', ['a.md']));
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
    const input = await checkInput(sandbox.path, 'integrity/stale-paths', ['a.md'], {
        check: [{ name: 'tests/coverage', command: ['true'], paths: ['tests/**'], stage: 'manual' }],
    });
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
    const found = stalePaths(await checkInput(sandbox.path, 'integrity/stale-paths', ['a.md']));
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
    const found = stalePaths(await checkInput(sandbox.path, 'integrity/stale-paths', ['docs/guide.md']));
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
    const found = stalePaths(await checkInput(sandbox.path, 'integrity/stale-paths', ['a.md']));
    expect(found.map((finding) => [finding.line, finding.message])).toStrictEqual([
        [6, 'src/missing.ts names no tracked file or folder.'],
    ]);
});

test.each([
    ['package.json', '{broken'],
    ['mise.toml', '[tasks'],
])('malformed %s reports its read failure instead of a missing task', async (path, text) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'a.md': 'Run `bun run build`.\n', [path]: text });
    const selected = await checkInput(sandbox.path, 'integrity/stale-paths', ['a.md']);
    expect(() => stalePaths(selected)).toThrow(`Cannot read task definitions from ${path}.`);
});

test('a directory at a task configuration path is an error, not absent configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'a.md': 'Run `bun run build`.\n', 'package.json': {} });
    const selected = await checkInput(sandbox.path, 'integrity/stale-paths', ['a.md']);
    expect(() => stalePaths(selected)).toThrow('Cannot read task definitions from package.json.');
});
