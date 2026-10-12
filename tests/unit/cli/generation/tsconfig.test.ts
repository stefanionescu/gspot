import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildTsconfig, requiredTsconfigOptions } from '#cli/generation/tsconfig.ts';
import { MALFORMED_TSCONFIGS, STRICT_TSCONFIG_TEXT } from '#tests/config/typescript.ts';

test.each(MALFORMED_TSCONFIGS)(
    'a malformed tsconfig.json fails with its path and reason: %s',
    async (content, detail) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'tsconfig.json': content,
            'gspot.toml': settingsText(['typescript']),
            'source.ts': 'export const value = 1;\n',
        });
        const session = await openSession(sandbox.path);
        expect(() =>
            buildTsconfig({
                root: session.root,
                typeRootsFolder: session.root,
                reads: session.reads,
                target: '.gspot/state/tsconfig.json',
                scope: '',
                files: session.repository.files,
                scopeEntries: session.repository.scopes,
                options: {},
            }),
        ).toThrow(`Cannot read TypeScript configuration ${join(sandbox.path, 'tsconfig.json')}: ${detail}`);
    },
);

test('the strict compiler options leave out an ignored rule and keep your own options', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['typescript'], {
            tables: '[[ignore]]\ncheck = "typescript/tsconfig"\nrule = "noImplicitReturns"\nreason = "Returns are checked separately."\n',
            level: 'all',
        }),
        'source.ts': 'export const value = 1;',
        'tsconfig.json': STRICT_TSCONFIG_TEXT,
    });
    const session = await openSession(sandbox.path);
    const scope = session.scopes[0]!;
    const options = Object.fromEntries(
        Object.entries(requiredTsconfigOptions('all', scope.selected)).filter(
            ([name]) => !scope.view.rulesOff('typescript/tsconfig').includes(name),
        ),
    );
    const parsed = buildTsconfig({
        root: session.root,
        typeRootsFolder: session.root,
        reads: session.reads,
        target: '.gspot/state/tsconfig.json',
        scope: '',
        files: session.repository.files,
        scopeEntries: session.repository.scopes,
        options,
    });
    expect(parsed).toMatchObject({
        extends: '../../tsconfig.json',
        compilerOptions: { strict: true, noPropertyAccessFromIndexSignature: true },
    });
    expect(parsed).not.toHaveProperty('compilerOptions.noImplicitReturns');
});

test('framework compiler options apply only in their scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['typescript'], {
            level: 'all',
            tables: '[[scope]]\npath = "service"\n\nconfigurations = ["nestjs"]',
        }),
        'tsconfig.json': STRICT_TSCONFIG_TEXT,
        'source.ts': 'export const port = 8080;\n',
        'service/tsconfig.json':
            '{"extends":"../tsconfig.json","compilerOptions":{"experimentalDecorators":true,"emitDecoratorMetadata":true}}',
        'service/source.ts': 'export const port = 3000;\n',
    });
    const session = await openSession(sandbox.path);
    const projects = session.scopes.map((scope) => ({
        scope: scope.scope.path,
        config: buildTsconfig({
            root: session.root,
            typeRootsFolder: session.root,
            reads: session.reads,
            target: `.gspot/state/${scope.scope.path}/tsconfig.json`,
            scope: scope.scope.path,
            files: session.repository.files,
            scopeEntries: session.repository.scopes,
            options: requiredTsconfigOptions('all', scope.selected),
        }),
    }));
    expect(projects.find(({ scope }) => scope === 'service')?.config).toHaveProperty(
        'compilerOptions.experimentalDecorators',
        true,
    );
    expect(projects.find(({ scope }) => scope === '')?.config).not.toHaveProperty(
        'compilerOptions.experimentalDecorators',
    );
});
