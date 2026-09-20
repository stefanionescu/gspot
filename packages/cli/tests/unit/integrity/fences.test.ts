import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import { fences } from '#cli/integrity/fences.ts';
import type { MergedView } from '#types/config.ts';
import type { CheckSpec } from '#types/manifest.ts';
import type { Repository } from '#types/repository.ts';
import type { EngineInput, Session } from '#types/run.ts';
import { stalePaths } from '#cli/integrity/stale-paths.ts';

function input(root: string, paths: string[], tracked = paths): EngineInput {
    const files = paths.map((path) => ({
        path,
        nature: 'source' as const,
        tags: ['text'],
        executable: false,
        size: 1,
    }));
    const all = tracked.map((path) => ({
        path,
        nature: 'source' as const,
        tags: ['text'],
        executable: false,
        size: 1,
    }));
    const partialView: Partial<MergedView> = { tool: () => ({}) };
    const view = partialView as MergedView;
    const repository: Partial<Repository> = { files: all };
    const partialSession: Partial<Session> = { repository: repository as Repository, manifests: new Map() };
    const session = partialSession as Session;
    const spec: Partial<CheckSpec> = { name: 'markdown/fences' };
    const partial: Partial<EngineInput> = { root, scope: '', spec: spec as CheckSpec, files, view, session };
    return partial as EngineInput;
}

describe('fences and paths', () => {
    test('a fenced block that does not parse in its language is a finding', async () => {
        await using sandbox = await createSandbox({
            'a.md': '```json\n{"a": 1}\n```\n\n```json\n{oops\n```\n\n```toml\nkey = \n```\n\n```ts\nconst a: number = 1;\n```\n\n```text\nnot code {\n```\n',
        });
        const found = await fences(input(sandbox.path, ['a.md']));
        expect(found.map((finding) => [finding.line, finding.rule])).toEqual([
            [5, 'json'],
            [9, 'toml'],
        ]);
    });

    test('a path nobody tracks and a task nobody defines are findings; fenced text is not', async () => {
        await using sandbox = await createSandbox({
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
        await using sandbox = await createSandbox({
            'a.md': '> ~~~json\n> {oops\n> ~~~~\n\n```json\n{oops\n',
        });
        const found = await fences(input(sandbox.path, ['a.md']));
        expect(found.map((finding) => [finding.line, finding.rule])).toEqual([
            [1, 'json'],
            [5, 'json'],
        ]);
    });

    test('nested tilde text is excluded while shell paths remain checked', async () => {
        await using sandbox = await createSandbox({
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
        await using sandbox = await createSandbox({ 'a.md': 'Run `bun run build`.\n', [path]: text });
        expect(() => stalePaths(input(sandbox.path, ['a.md']))).toThrow(`Cannot read task definitions from ${path}.`);
    });

    test('a directory at a task configuration path is an error, not absent configuration', async () => {
        await using sandbox = await createSandbox({ 'a.md': 'Run `bun run build`.\n', 'package.json': null });
        expect(() => stalePaths(input(sandbox.path, ['a.md']))).toThrow(
            'Cannot read task definitions from package.json.',
        );
    });
});
