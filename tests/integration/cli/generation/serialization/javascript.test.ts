import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { openSession } from '#cli/execution/session.ts';
import { parserFor } from '#cli/parsers/tree-sitter.ts';

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
                configurations: ['javascript', 'docker', 'prose'],
                tools: {
                    eslint: { extra: { reason, name: 'custom' } },
                    trivy: { ignore: [{ id: 'CVE-2026-12345', reason }] },
                },
                ignore: [{ check: 'prose/vale', rule: 'Vale.Spelling', reason }],
            }),
        });
        const renderSession4 = await openSession(sandbox.path);
        const output = emitAll(renderSession4.policyFiles.policy, renderSession4.repository, renderSession4.scopes, {
            version: renderSession4.version,
            packageManager: renderSession4.packageManager,
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
                configurations: ['javascript'],
                tools: { eslint: { globals: { '**/*.js': runtime } } },
            }),
        });
        const renderSession6 = await openSession(sandbox.path);
        const output = emitAll(renderSession6.policyFiles.policy, renderSession6.repository, renderSession6.scopes, {
            version: renderSession6.version,
            packageManager: renderSession6.packageManager,
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
