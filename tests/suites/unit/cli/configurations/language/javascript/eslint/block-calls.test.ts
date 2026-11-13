import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { ESCAPED_SCOPE_CONFIGURATIONS } from '#tests/config/configurations/javascript/overrides.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a scope named with glob characters keeps its rules in its own folder', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"type":"module"}\n',
        'app[1]/source.js': "import 'node:fs';\n",
        'app1/source.js': "import 'node:fs';\n",
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            scopes: [{ path: 'app1' }, { path: 'app[1]' }],
            tables: '[scope.javascript]\nbanned_imports = [{ name = "node:fs", message = "Use the storage service." }]\n',
        }),
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['app[[]1]/source.js', 'app1/source.js'],
            ['no-restricted-imports'],
        ),
    ).toStrictEqual([{ file: 'app[1]/source.js', rule: 'no-restricted-imports', line: 1 }]);
});

test('a scope path with a quote and code stays a string literal in the ESLint file selectors', async () => {
    expect(await parseScopeShape("scope'; throw 1; '")).toBe(await parseScopeShape('example'));
});

async function parseScopeShape(scopePath: string): Promise<string> {
    const child = `${scopePath}/child`;
    await using sandbox = await createGitSandbox({
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
