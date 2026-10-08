import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
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
                configurations: ['javascript', 'docker', 'prose'],
                tools: {
                    eslint: { verbatim: { name: 'custom' } },
                },
                reasons: { 'tools.eslint.verbatim': reason },
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
        const output = emitAll(session);
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
        expect(ignored!.content.split('\n').filter((line) => line !== '' && !line.startsWith('#'))).toStrictEqual([]);
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
    for (const runtime of ['node', 'browser', 'worker', 'service-worker']) {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'source.js': 'export const value = 1;\n',
            'gspot.toml': stringify({
                configurations: ['javascript'],
                tools: { eslint: { runtimes: { '**/*.js': runtime } } },
            }),
        });
        const session = await openSession(sandbox.path);
        const output = emitAll(session);
        const file = output.files.find((entry) => entry.path === '.gspot/config/eslint.config.mjs');
        expect(file).toBeDefined();
        const tree = parser.parse(file!.content);
        expect(tree).not.toBeNull();
        try {
            expect(tree!.rootNode.hasError).toBe(false);
            const runtimes = tree!.rootNode
                .descendantsOfType('pair')
                .filter((node) => node.childForFieldName('key')?.text === '"runtime"')
                .map((node): unknown => JSON.parse(node.childForFieldName('value')!.text));
            expect(runtimes).toStrictEqual(['node', 'commonjs', runtime]);
        } finally {
            tree!.delete();
        }
    }
});
