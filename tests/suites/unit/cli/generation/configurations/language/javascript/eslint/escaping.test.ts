import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { openSession } from '#cli/planning/session.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { ESCAPED_SCOPE_CONFIGURATIONS } from '#tests/config/generation/configurations/language/javascript/eslint/eslint.ts';

async function parseScopeShape(scopePath: string): Promise<string> {
    await using sandbox = await testdir();
    const child = `${scopePath}/child`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(ESCAPED_SCOPE_CONFIGURATIONS, {
            rules: true,
            tables: stringify({
                scope: [
                    { path: scopePath, configurations: ESCAPED_SCOPE_CONFIGURATIONS },
                    { path: child, configurations: ESCAPED_SCOPE_CONFIGURATIONS },
                ],
            }),
        }),
        [`${scopePath}/source.js`]: 'export const value = 1;',
        [`${child}/source.js`]: 'export const value = 2;',
    });
    const session = await openSession(sandbox.path);
    const output = buildGeneratedFiles(session);
    const file = output.files.find((each) => each.path === getManifestTarget('javascript', 'eslint/eslint.mjs'))!;
    using tree = await parseSource('javascript', file.content);
    expect(tree.rootNode.hasError).toBe(false);
    const shape = tree.rootNode.toString();
    const literals = tree.rootNode
        .descendantsOfType('string')
        .filter((node) => node.text.includes(scopePath === 'example' ? scopePath : 'throw 1'))
        .map((node): unknown => JSON.parse(node.text));
    expect(literals).toContain(`${scopePath}/**/*`);
    expect(literals).toContain(`${child}/**/*`);
    expect(literals).toContain(`${child}/**`);
    const eslint = await buildEslint(sandbox.path);
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
