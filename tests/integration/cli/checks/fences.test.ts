import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { rejects } from 'node:assert/strict';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { fences } from '#cli/checks/docs/fences.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { openSession } from '#cli/execution/session.ts';
import { checkInput } from '#tests/support/cli/input.ts';
import { stalePaths } from '#cli/checks/docs/stale-paths.ts';

describe('fences and paths', () => {
    test('a fenced block that does not parse in its language is a finding', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'a.md': '```json\n{"a": 1}\n```\n\n```json\n{oops\n```\n\n```toml\nkey = \n```\n\n```ts\nconst a: number = 1;\n```\n\n```text\nnot code {\n```\n',
        });
        const found = await fences(await checkInput(sandbox.path, 'markdown/fences', ['a.md']));
        expect(found.map((finding) => [finding.line, finding.rule])).toStrictEqual([
            [5, 'json'],
            [9, 'toml'],
        ]);
    });

    test('a path nobody tracks and a task nobody defines are findings; fenced text is not', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'a.md': 'See `src/here.ts` and `src/gone.ts`, then run `mise run build` and `mise run gone`.\n\n```text\nlib/whatever.ts\n```\n',
            'src/here.ts': 'export {};\n',
            'mise.toml': '[tasks.build]\nrun = "x"\n',
        });
        const found = stalePaths(await checkInput(sandbox.path, 'integrity/stale-paths', ['a.md']));
        expect(found.map((finding) => finding.message)).toStrictEqual([
            'src/gone.ts names no tracked file or folder.',
            'mise run gone names no task or script.',
        ]);
    });
    test('tilde fences and unclosed examples still report invalid code', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'a.md': '> ~~~json\n> {oops\n> ~~~~\n\n```json\n{oops\n',
        });
        const found = await fences(await checkInput(sandbox.path, 'markdown/fences', ['a.md']));
        expect(found.map((finding) => [finding.line, finding.rule])).toStrictEqual([
            [1, 'json'],
            [5, 'json'],
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
});

test('Bash examples report syntax errors, accept corrections, and stop on cancellation', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'a.md': '```bash\nif then\n```\n',
    });
    const session = await openSession(sandbox.path);
    let selected: EngineInput = {
        ...(await checkInput(sandbox.path, 'markdown/fences', ['a.md'])),
        probes: session.probes,
        view: session.scopes[0]!.view,
    };
    const found = await fences(selected);
    expect(found).toMatchObject([{ check: 'markdown/fences', file: 'a.md', line: 1, rule: 'bash', fixable: false }]);
    expect(found[0]!.message).toContain('syntax error');
    writeFileSync(join(sandbox.path, 'a.md'), '```bash\nprintf "%s\\n" "Hello"\n```\n');
    selected = await checkInput(sandbox.path, 'markdown/fences', ['a.md']);
    expect(await fences(selected)).toStrictEqual([]);
    selected.cancelSignal = AbortSignal.abort();
    await rejects(fences(selected), { message: 'The command was canceled.' });
});
