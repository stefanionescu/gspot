import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import stylelint, { type Config } from 'stylelint';
import { testdir, createFileTree } from 'testdirs';
import { testModules } from '#tests/setup/modules.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { targetInScope } from '#cli/repository/scopes.ts';
import type { StylelintToolFile } from '#tests/types/tool-files.ts';
import { STYLELINT_SCOPE_FILES, STYLELINT_SCOPE_TABLES } from '#tests/config/stylelint.ts';

test('Vue and Svelte stylesheet rules stay inside their scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['css'], { level: 'all', tables: STYLELINT_SCOPE_TABLES }),
        ...STYLELINT_SCOPE_FILES,
    });
    const outputs = emitAll(await openSession(sandbox.path)).files;
    const documents = Object.fromEntries(
        ['', 'vue', 'svelte', 'mixed'].map((scope) => {
            const prefix = scope === '' ? '' : `${scope}/`;
            const output = outputs.find((file) => file.path === `.gspot/config/${prefix}stylelint.json`)!;
            return [scope, JSON.parse(output.content) as StylelintToolFile];
        }),
    );
    expect(documents['']!.overrides).toBeUndefined();
    expect(
        documents['vue']!.overrides?.map(({ files, customSyntax: syntax }) => ({ files, customSyntax: syntax })),
    ).toStrictEqual([{ files: ['**/*.vue'], customSyntax: 'postcss-html' }]);
    expect(
        documents['svelte']!.overrides?.map(({ files, customSyntax: syntax }) => ({ files, customSyntax: syntax })),
    ).toStrictEqual([{ files: ['**/*.svelte'], customSyntax: 'postcss-html' }]);
    expect(
        documents['mixed']!.overrides?.map(({ files, customSyntax: syntax }) => ({ files, customSyntax: syntax })),
    ).toStrictEqual([
        { files: ['**/*.vue'], customSyntax: 'postcss-html' },
        { files: ['**/*.svelte'], customSyntax: 'postcss-html' },
    ]);
});

test.each(['recommended', 'all'] as const)(
    "your Stylelint rule options reach each scope's file, and level-gated and unknown rules are dropped (%s)",
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['css'], {
                level,
                tables: `[tools.stylelint.rules]\ncolor-hex-length = "long"\nnumber-max-precision = 0\nunknown-rule = true\n[[scope]]\npath = "child"\n\n`,
            }),
            'source.css': 'a { color: #fff; width: 1.23456px; }',
            'child/source.css': 'a { color: #fff; width: 1.23456px; }',
        });
        const session = await openSession(sandbox.path);
        const generated = emitAll(session);
        const paths = new Set(generated.files.map(({ path }) => path));
        const declaration = session.scopes[0]!.selected.flatMap(({ toolFiles }) => toolFiles).find(
            ({ target }) => target === '.gspot/config/stylelint.json',
        )!;
        expect(generated.files.filter(({ path }) => path.endsWith('/stylelint.json'))).toHaveLength(1);
        for (const scope of ['', 'child']) {
            const target = targetInScope(scope, declaration, paths);
            const file = generated.files.find(({ path }) => path === target)!;
            const config = JSON.parse(file.content) as Config;
            expect(config.rules!['color-hex-length']).toBe('long');
            expect(config.rules!['number-max-precision']).toBe(level === 'all' ? 0 : null);
            expect(config.rules!['unknown-rule']).toBeUndefined();
            const result = await stylelint.lint({
                code: 'a { color: #fff; width: 1.23456px; }',
                config,
                configBasedir: testModules,
            });
            expect(
                result.results
                    .flatMap(({ warnings }) => warnings)
                    .filter(({ rule }) => rule === 'color-hex-length')
                    .map(({ severity }) => severity),
            ).toStrictEqual(['error']);
            expect(
                result.results
                    .flatMap(({ warnings }) => warnings)
                    .filter(({ rule }) => rule === 'number-max-precision'),
            ).toHaveLength(level === 'all' ? 1 : 0);
        }
    },
);
