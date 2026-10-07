import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/commands/session.ts';
import { parserFor } from '#cli/parsers/tree-sitter.ts';
import { createEslint } from '#tests/harness/generated.ts';

test('scope paths remain string literals in fragment file selectors and child exclusions', async () => {
    const parser = await parserFor('javascript');
    const shapes: string[] = [];
    for (const scope of ['example', "scope'; throw 1; '"]) {
        await using sandbox = await testdir();
        const child = `${scope}/child`;
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                configurations: ['javascript', 'react'],
                scope: [
                    { path: scope, configurations: ['javascript', 'react'] },
                    { path: child, configurations: ['javascript', 'react'] },
                ],
            }),
            [`${scope}/source.js`]: 'export const value = 1;',
            [`${child}/source.js`]: 'export const value = 2;',
        });
        const session = await openSession(sandbox.path);
        const output = emitAll(session);
        const file = output.files.find((entry) => entry.path === '.gspot/config/eslint.config.mjs');
        expect(file).toBeDefined();
        const tree = parser.parse(file!.content);
        expect(tree).not.toBeNull();
        try {
            expect(tree!.rootNode.hasError).toBe(false);
            shapes.push(tree!.rootNode.toString());
            const literals = tree!.rootNode
                .descendantsOfType('string')
                .filter((node) => node.text.includes(scope === 'example' ? scope : 'throw 1'))
                .map((node): unknown => JSON.parse(node.text));
            expect(literals).toContain(`${scope}/**/*`);
            expect(literals).toContain(`${child}/**/*`);
            expect(literals).toContain(`${child}/**`);
        } finally {
            tree!.delete();
        }
        const eslint = await createEslint(sandbox.path);
        const filePath = `${child}/source.js`;
        const invalid = await eslint.lintText('missing();', { filePath });
        expect(invalid.flatMap(({ messages }) => messages).some(({ ruleId }) => ruleId === 'no-undef')).toBe(true);
    }
    expect(new Set(shapes).size).toBe(1);
});
