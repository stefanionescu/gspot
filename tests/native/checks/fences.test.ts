import { rejects } from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import type { MergedView } from '#cli/types/policy.ts';
import type { CheckSpec } from '#cli/types/configurations.ts';
import { fences } from '#cli/checks/docs/fences.ts';
import type { EngineInput } from '#cli/types/execution.ts';
import { stalePaths } from '#cli/checks/docs/stale-paths.ts';

function input(root: string, paths: string[], tracked = paths): EngineInput {
    const files = paths.map((path) => ({
        path,
        prefix: Buffer.alloc(0),
        nature: 'source' as const,
        tags: ['text'],
        executable: false,
        size: 1,
    }));
    const all = tracked.map((path) => ({
        path,
        prefix: Buffer.alloc(0),
        nature: 'source' as const,
        tags: ['text'],
        executable: false,
        size: 1,
    }));
    const partialView: Partial<MergedView> = { tool: () => ({}) };
    const view = partialView as MergedView;
    const spec: Partial<CheckSpec> = { name: 'markdown/fences' };
    const partial: Partial<EngineInput> = {
        root,
        scope: '',
        spec: spec as CheckSpec,
        files,
        view,
        repositoryFiles: all,
        manifests: new Map(),
    };
    return partial as EngineInput;
}

describe('fences and paths', () => {
    test('a fenced block that does not parse in its language is a finding', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'a.md': '```json\n{"a": 1}\n```\n\n```json\n{oops\n```\n\n```toml\nkey = \n```\n\n```ts\nconst a: number = 1;\n```\n\n```text\nnot code {\n```\n',
        });
        const found = await fences(input(sandbox.path, ['a.md']));
        expect(found.map((finding) => [finding.line, finding.rule])).toEqual([
            [5, 'json'],
            [9, 'toml'],
        ]);
    });

    test('a path nobody tracks and a task nobody defines are findings; fenced text is not', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'a.md': 'See `src/here.ts` and `src/gone.ts`, then run `mise run build` and `mise run gone`.\n\n```text\nlib/whatever.ts\n```\n',
            'mise.toml': '[tasks.build]\nrun = "x"\n',
        });
        const found = await stalePaths(input(sandbox.path, ['a.md'], ['a.md', 'src/here.ts', 'mise.toml']));
        expect(found.map((finding) => finding.message)).toEqual([
            'src/gone.ts names no tracked file or folder.',
            'mise run gone names no task or script.',
        ]);
    });
    test('tilde fences and unclosed examples still report invalid code', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'a.md': '> ~~~json\n> {oops\n> ~~~~\n\n```json\n{oops\n',
        });
        const found = await fences(input(sandbox.path, ['a.md']));
        expect(found.map((finding) => [finding.line, finding.rule])).toEqual([
            [1, 'json'],
            [5, 'json'],
        ]);
    });

    test('nested tilde text is excluded while shell paths remain checked', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'a.md': '> ~~~text\n> src/example.ts\n> ~~~~\n\n~~~sh\ncat src/missing.ts\n~~~\n',
        });
        const found = await stalePaths(input(sandbox.path, ['a.md']));
        expect(found.map((finding) => [finding.line, finding.message])).toEqual([
            [6, 'src/missing.ts names no tracked file or folder.'],
        ]);
    });
    test.each([
        ['package.json', '{broken'],
        ['mise.toml', '[tasks'],
    ])('malformed %s reports its read failure instead of a missing task', async (path, text) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'a.md': 'Run `bun run build`.\n', [path]: text });
        expect(() => stalePaths(input(sandbox.path, ['a.md']))).toThrow(`Cannot read task definitions from ${path}.`);
    });

    test('a directory at a task configuration path is an error, not absent configuration', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'a.md': 'Run `bun run build`.\n', 'package.json': {} });
        expect(() => stalePaths(input(sandbox.path, ['a.md']))).toThrow(
            'Cannot read task definitions from package.json.',
        );
    });
});

test('Bash examples report syntax errors, accept corrections, and stop on cancellation', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'a.md': '```bash\nif then\n```\n',
    });
    const session = await openSession(sandbox.path);
    const selected: EngineInput = {
        ...input(sandbox.path, ['a.md']),
        probes: session.probes,
        view: session.scopes[0]!.view,
    };
    const found = await fences(selected);
    expect(found).toMatchObject([{ check: 'markdown/fences', file: 'a.md', line: 1, rule: 'bash', fixable: false }]);
    expect(found[0]!.message).toContain('syntax error');
    writeFileSync(join(sandbox.path, 'a.md'), '```bash\nprintf "%s\\n" "Hello"\n```\n');
    expect(await fences(selected)).toEqual([]);
    selected.cancelSignal = AbortSignal.abort();
    await rejects(fences(selected), { message: 'The command was canceled.' });
});
