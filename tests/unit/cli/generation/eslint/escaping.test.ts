import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { generate } from '#cli/generation/generate.ts';
import { parseSource } from '#cli/parsers/grammars.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { ESLINT_FILE } from '#tests/data/generation/settings.ts';
import { createEslint, collectLintFindings } from '#tests/setup/tool-files.ts';
import { SCOPE_CONFIGURATIONS } from '#tests/data/generation/eslint/selectors.ts';

/** Generate, parse, and lint one scope before returning its JavaScript syntax shape. */
async function parseScopeShape(scope: string): Promise<string> {
    let shape: string;
    await using sandbox = await testdir();
    const child = `${scope}/child`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(SCOPE_CONFIGURATIONS, {
            rules: true,
            tables: stringify({
                scope: [
                    { path: scope, configurations: SCOPE_CONFIGURATIONS },
                    { path: child, configurations: SCOPE_CONFIGURATIONS },
                ],
            }),
        }),
        [`${scope}/source.js`]: 'export const value = 1;',
        [`${child}/source.js`]: 'export const value = 2;',
    });
    const session = await openSession(sandbox.path);
    const output = generate(session);
    const file = output.files.find((entry) => entry.path === ESLINT_FILE);
    expect(file).toBeDefined();
    const tree = await parseSource('javascript', file!.content);
    expect(tree).not.toBeNull();
    try {
        expect(tree.rootNode.hasError).toBe(false);
        shape = tree.rootNode.toString();
        const literals = tree.rootNode
            .descendantsOfType('string')
            .filter((node) => node.text.includes(scope === 'example' ? scope : 'throw 1'))
            .map((node): unknown => JSON.parse(node.text));
        expect(literals).toContain(`${scope}/**/*`);
        expect(literals).toContain(`${child}/**/*`);
        expect(literals).toContain(`${child}/**`);
    } finally {
        tree.delete();
    }
    const eslint = await createEslint(sandbox.path);
    const filePath = `${child}/source.js`;
    await createFileTree(sandbox.path, { [filePath]: 'missing();' });
    expect(await collectLintFindings(eslint, sandbox.path, [filePath], ['no-undef'])).toStrictEqual([
        { file: filePath, rule: 'no-undef', line: 1 },
    ]);
    return shape;
}

test('a scope path with a quote and code stays a string literal in the ESLint file selectors', async () => {
    expect(await parseScopeShape("scope'; throw 1; '")).toBe(await parseScopeShape('example'));
});
