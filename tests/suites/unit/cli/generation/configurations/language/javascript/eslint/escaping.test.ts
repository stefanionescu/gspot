import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { generate } from '#cli/generation/generate.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

import {
    ESLINT_FILE,
    ESCAPED_SCOPE_CONFIGURATIONS,
} from '#tests/config/generation/configurations/language/javascript/eslint/escaping.ts';

async function parseScopeShape(scope: string): Promise<string> {
    let shape: string;
    await using sandbox = await testdir();
    const child = `${scope}/child`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(ESCAPED_SCOPE_CONFIGURATIONS, {
            rules: true,
            tables: stringify({
                scope: [
                    { path: scope, configurations: ESCAPED_SCOPE_CONFIGURATIONS },
                    { path: child, configurations: ESCAPED_SCOPE_CONFIGURATIONS },
                ],
            }),
        }),
        [`${scope}/source.js`]: 'export const value = 1;',
        [`${child}/source.js`]: 'export const value = 2;',
    });
    const session = await openSession(sandbox.path);
    const output = generate(session);
    const file = output.files.find((each) => each.path === ESLINT_FILE)!;
    const tree = await parseSource('javascript', file.content);
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
    expect(await listLintFindings(eslint, sandbox.path, [filePath], ['no-undef'])).toStrictEqual([
        { file: filePath, rule: 'no-undef', line: 1 },
    ]);
    return shape;
}

test('a scope path with a quote and code stays a string literal in the ESLint file selectors', async () => {
    expect(await parseScopeShape("scope'; throw 1; '")).toBe(await parseScopeShape('example'));
});
