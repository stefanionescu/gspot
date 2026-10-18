import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { generate } from '#cli/generation/generate.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { ESLINT_FILE } from '#tests/data/generation/tool-files.ts';
import { createEslint, collectLintFindings } from '#tests/setup/tool-files.ts';
import { SCOPE_CONFIGURATIONS } from '#tests/data/generation/eslint/selectors.ts';

/** Generate, parse, and lint one scope before returning its JavaScript syntax shape. */
async function parseScopeShape(scope: string): Promise<string> {
    let shape: string;
    await using sandbox = await testdir();
    const child = `${scope}/child`;
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: SCOPE_CONFIGURATIONS,
            scope: [
                { path: scope, configurations: SCOPE_CONFIGURATIONS },
                { path: child, configurations: SCOPE_CONFIGURATIONS },
            ],
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

test('a reason text cannot add JavaScript statements or ignore entries', async () => {
    const shapes: string[] = [];
    const reasons = [
        'Reviewed upstream.',
        'Reviewed upstream.\n];\nglobalThis.injected = true;\nexport default [',
        'Reviewed upstream.\u{2028}];\u{2029}globalThis.injected = true;\nexport default [',
    ];
    for (const reason of reasons) {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                configurations: ['javascript', 'docker', 'prose'],
                tools: {
                    eslint: { extra: { value: { name: 'custom' }, reason } },
                },
                ignore: [
                    { check: 'prose/vale', rule: 'Vale.Spelling', reason },
                    { check: 'docker/trivy-config', rule: 'CVE-2026-12345', reason },
                ],
            }),
        });
        await createFileTree(sandbox.path, {
            'sample.js': 'export const value = 1;',
            'sample.md': '# Sample',
            Dockerfile: 'FROM alpine:3.22',
        });
        const session = await openSession(sandbox.path);
        const output = generate(session);
        const script = output.files.find(
            (file) => file.path === '.gspot/configurations/language/javascript/eslint.mjs',
        );
        expect(script).toBeDefined();
        const tree = await parseSource('javascript', script!.content);
        expect(tree).not.toBeNull();
        try {
            expect(tree.rootNode.hasError).toBe(false);
            shapes.push(tree.rootNode.toString());
        } finally {
            tree.delete();
        }
        const vale = output.files.find((file) => file.path === '.gspot/configurations/general/prose/vale.ini');
        expect(vale).toBeDefined();
        expect(
            vale!.content
                .split('\n')
                .filter((line) => line !== '' && !line.startsWith('#'))
                .every((line) => !line.includes('globalThis')),
        ).toBe(true);
    }
    expect(new Set(shapes).size).toBe(1);
});
