import { describe, expect, spyOn, test } from 'bun:test';
import { identifiersOf } from '#cli/checks/naming/extract.ts';
import { scriptFunctions } from '#cli/checks/structure/parser.ts';
import { parserFor, parseSource } from '#cli/parsers/tree-sitter.ts';
import { codeLines, withoutComment } from '#cli/checks/structure/code-lines.ts';

test('shared parse handles retain grammar, source, and independent disposal boundaries', async () => {
    const observations = { root: '/repository', sources: new Map<string, Buffer>() };
    const resources = new DisposableStack();
    const context = { observations, resources };
    const source = 'const label: string = "ready";';
    const first = await parseSource('typescript', source, context);
    const sibling = await parseSource('typescript', source, context);
    const javascript = await parseSource('javascript', source, context);
    const corrected = await parseSource('javascript', 'const label = "ready";', context);
    try {
        expect(first?.rootNode.hasError).toBe(false);
        expect(javascript?.rootNode.hasError).toBe(true);
        expect(corrected?.rootNode.hasError).toBe(false);
        expect(sibling?.rootNode.text).toBe(source);
        resources.dispose();
        expect(first?.rootNode.text).toBe(source);
        expect(sibling?.rootNode.text).toBe(source);
        using refreshedResources = new DisposableStack();
        const refreshed = await parseSource('typescript', source, { observations, resources: refreshedResources });
        try {
            expect(refreshed?.rootNode.hasError).toBe(false);
            expect(refreshed?.rootNode.text).toBe(source);
        } finally {
            refreshed?.delete();
        }
    } finally {
        first?.delete();
        sibling?.delete();
        javascript?.delete();
        corrected?.delete();
        resources.dispose();
    }
});

describe('shell parsing', () => {
    test('comments are stripped with quotes respected', () => {
        expect(withoutComment('echo "a # b" # c')).toBe('echo "a # b" ');
        expect(withoutComment("printf '#'")).toBe("printf '#'");
        expect(withoutComment(String.raw`x=1 \# y`)).toBe(String.raw`x=1 \# y`);
        expect(codeLines(['', '# note', 'a=1 # b', '  '])).toStrictEqual([{ number: 3, code: 'a=1' }]);
    });

    test('functions carry their range and body', async () => {
        const found = await scriptFunctions(
            '#!/usr/bin/env bash\n_one() {\n    echo 1\n}\n\nmain() {\n    _one "$@"\n}\n',
        );
        expect(found).toStrictEqual([
            { name: '_one', start: 2, end: 4, body: ['    echo 1'], statements: 1 },
            { name: 'main', start: 6, end: 8, body: ['    _one "$@"'], statements: 1 },
        ]);
    });
});

test('Bash and naming analysis reject missing trees and accept corrected parsing', async () => {
    using resources = new DisposableStack();
    const context = { resources, observations: { root: '/repository', sources: new Map<string, Buffer>() } };
    const parser = await parserFor('bash');
    const parse = spyOn(parser, 'parse').mockReturnValue(null);
    try {
        await expect(scriptFunctions('run() { echo ready; }', context)).rejects.toThrow('no tree');
        await expect(identifiersOf('run.sh', 'run() { echo ready; }', 'bash', context)).rejects.toThrow('no tree');
    } finally {
        parse.mockRestore();
    }
    expect(await scriptFunctions('run() { echo ready; }', context)).toHaveLength(1);
    expect(
        (await identifiersOf('run.sh', 'run() { echo ready; }', 'bash', context)).map((entry) => entry.name),
    ).toContain('run');
});
