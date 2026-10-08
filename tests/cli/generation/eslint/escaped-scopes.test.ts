import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { parserFor } from '#cli/parsers/source/public.ts';
import { createEslint } from '#tests/harness/generated.ts';

/** Generate, parse, and lint one scope before returning its JavaScript syntax shape. */
async function scopeShape(scope: string): Promise<string> {
    const parser = await parserFor('javascript');
    let shape: string;
    await using sandbox = await testdir();
    const child = `${scope}/child`;
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: ['javascript', 'react'],
            scope: {
                [scope]: { configurations: ['javascript', 'react'] },
                [child]: { configurations: ['javascript', 'react'] },
            },
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
        shape = tree!.rootNode.toString();
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
    return shape;
}

test.each(['example', "scope'; throw 1; '"])(
    'scope path %s remains a string literal in fragment file selectors and child exclusions',
    async (scope) => {
        expect(await scopeShape(scope)).toBe(await scopeShape('example'));
    },
);
