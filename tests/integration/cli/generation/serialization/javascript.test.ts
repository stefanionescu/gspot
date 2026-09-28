import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { parserFor } from '#cli/parsers/tree-sitter.ts';
import { generatedEslint } from '#tests/support/cli/generated/eslint.ts';

test('reason comments cannot add JavaScript statements or ignore entries', async () => {
    const parser = await parserFor('javascript');
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
                version: 1,
                kits: ['javascript', 'docker', 'prose'],
                tools: {
                    eslint: { extra: { reason, name: 'custom' } },
                    trivy: { ignore: [{ id: 'CVE-2026-12345', reason }] },
                },
                ignore: [{ check: 'prose/vale', rule: 'Vale.Spelling', reason }],
            }),
        });
        const session = await openSession(sandbox.path);
        const output = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageClient: session.packageClient,
        });
        const script = output.files.find((file) => file.path === '.gspot/config/eslint.config.mjs');
        expect(script).toBeDefined();
        const tree = parser.parse(script!.content);
        expect(tree).not.toBeNull();
        try {
            expect(tree!.rootNode.hasError).toBe(false);
            shapes.push(tree!.rootNode.toString());
        } finally {
            tree!.delete();
        }
        const ignored = output.files.find((file) => file.path === '.gspot/config/trivyignore');
        expect(ignored).toBeDefined();
        expect(ignored!.content.split('\n').filter((line) => line !== '' && !line.startsWith('#'))).toStrictEqual([
            'CVE-2026-12345',
        ]);
        const vale = output.files.find((file) => file.path === '.gspot/config/vale.ini');
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

test('runtime names remain data in generated JavaScript', async () => {
    const parser = await parserFor('javascript');
    for (const runtime of ['node', 'node }; globalThis.injected = true; //', 'node"\n/* café */']) {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                version: 1,
                kits: ['javascript'],
                tools: { eslint: { globals: { '**/*.js': runtime } } },
            }),
        });
        const session = await openSession(sandbox.path);
        const output = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageClient: session.packageClient,
        });
        const file = output.files.find((entry) => entry.path === '.gspot/config/eslint.config.mjs');
        expect(file).toBeDefined();
        const tree = parser.parse(file!.content);
        expect(tree).not.toBeNull();
        try {
            expect(tree!.rootNode.hasError).toBe(false);
            const indices = tree!.rootNode
                .descendantsOfType('subscript_expression')
                .filter((node) => node.childForFieldName('object')?.text === 'globals')
                .map((node) => node.childForFieldName('index')!.text);
            expect(indices).toHaveLength(1);
            expect(JSON.parse(indices[0]!)).toBe(runtime);
        } finally {
            tree!.delete();
        }
    }
});

test('scope paths remain string literals in fragment file selectors and child exclusions', async () => {
    const parser = await parserFor('javascript');
    const shapes: string[] = [];
    for (const scope of ['example', "scope'; throw 1; '"]) {
        await using sandbox = await testdir();
        const child = `${scope}/child`;
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                version: 1,
                kits: ['javascript', 'react'],
                scope: [
                    { path: scope, kits: ['javascript', 'react'] },
                    { path: child, kits: ['javascript', 'react'] },
                ],
            }),
            [`${scope}/source.js`]: 'export const value = 1;',
            [`${child}/source.js`]: 'export const value = 2;',
        });
        const session = await openSession(sandbox.path);
        const output = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageClient: session.packageClient,
        });
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
        const eslint = await generatedEslint(sandbox.path);
        const filePath = `${child}/source.js`;
        const invalid = await eslint.lintText('missing();', { filePath });
        expect(invalid.flatMap(({ messages }) => messages).some(({ ruleId }) => ruleId === 'no-undef')).toBe(true);
        const corrected = await eslint.lintText('export const value = 1;', { filePath });
        expect(
            corrected.flatMap(({ messages }) => messages).filter(({ ruleId }) => ruleId === 'no-undef'),
        ).toStrictEqual([]);
    }
    expect(new Set(shapes).size).toBe(1);
});
