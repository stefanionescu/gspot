import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { getTsconfig } from '#cli/parsers/tsconfig.ts';
import { openSession } from '#cli/commands/session.ts';
import { aliasesFor } from '#cli/repository/aliases.ts';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { ALIAS_INPUTS, ALIAS_PROJECT } from '#tests/config/cli/repository/aliases.ts';

test.each(ALIAS_INPUTS)('alias reads report malformed $path', async ({ path, diagnostic }) => {
    await using sandbox = await testdir({ [path]: '{ "compilerOptions": { "paths": {} },' });
    expect(() => aliasesFor(sandbox.path, '', { root: sandbox.path, sources: new Map(), memo: new Map() })).toThrow(
        diagnostic.replace('{PATH}', join(sandbox.path, path)),
    );
});

test.each(ALIAS_INPUTS)(
    'alias reads refuse an authored $path linked outside the repository',
    async ({ path, valid }) => {
        await using sandbox = await testdir();
        await using outside = await testdir({ [path]: valid });
        await symlink(join(outside.path, path), join(sandbox.path, path));
        expect(() => aliasesFor(sandbox.path, '', { root: sandbox.path, sources: new Map(), memo: new Map() })).toThrow(
            'Source link leaves the repository',
        );
    },
);

test('root and child aliases read their own declarations with compiler paths taking precedence', async () => {
    await using sandbox = await testdir(ALIAS_PROJECT);
    expect(aliasesFor(sandbox.path, '', { root: sandbox.path, sources: new Map(), memo: new Map() })).toStrictEqual({
        '#app/': 'src/',
        '#root/': 'root/',
        '@root/': 'typed/',
        '#shared/': 'compiler/',
    });
    expect(aliasesFor(sandbox.path, 'web', { root: sandbox.path, sources: new Map(), memo: new Map() })).toStrictEqual({
        '#app/': 'web/src/',
        '@web/': 'web/typed/',
        '#shared/': 'web/compiler/',
    });
});

test('alias reads follow an extends into a linked node_modules package', async () => {
    await using sandbox = await testdir();
    await using dependency = await testdir();
    await createFileTree(sandbox.path, {
        'tsconfig.json': '{"extends":"./node_modules/shared-config/tsconfig.json"}',
    });
    await createFileTree(dependency.path, { 'tsconfig.json': '{"compilerOptions":{"strict":true}}' });
    await mkdir(join(sandbox.path, 'node_modules'));
    await symlink(dependency.path, join(sandbox.path, 'node_modules/shared-config'), 'dir');
    expect(aliasesFor(sandbox.path, '', { root: sandbox.path, sources: new Map(), memo: new Map() })).toStrictEqual({});
});

test('alias discovery accepts absent configuration files', async () => {
    await using sandbox = await testdir();
    expect(aliasesFor(sandbox.path, '', { root: sandbox.path, sources: new Map(), memo: new Map() })).toStrictEqual({});
});

test('inherited aliases resolve from the configuration that declares them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'tsconfig.json': '{"extends":"./configs/tsconfig.json"}',
        'configs/tsconfig.json': '{"compilerOptions":{"paths":{"@app/*":["../src/*"]}}}',
    });
    expect(aliasesFor(sandbox.path, '', { root: sandbox.path, sources: new Map(), memo: new Map() })).toStrictEqual({
        '@app/': 'src/',
    });
    await writeFile(
        join(sandbox.path, 'configs/tsconfig.json'),
        '{"compilerOptions":{"baseUrl":"../app","paths":{"@app/*":["src/*"]}}}',
    );
    expect(aliasesFor(sandbox.path, '', { root: sandbox.path, sources: new Map(), memo: new Map() })).toStrictEqual({
        '@app/': 'app/src/',
    });
});

test('generated compiler configurations extend their authored alias owners', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], {
            level: 'all',
            tables: '[scope."web"]\nconfigurations = ["typescript"]\n',
        }),
        'web/tsconfig.json': ALIAS_PROJECT['web/tsconfig.json'],
        'web/source.ts': 'export const count = 1;\n',
        'tsconfig.json': '{"compilerOptions":{"paths":{"@app/*":["./src/*"]}}}',
    });
    const session = await openSession(sandbox.path);
    expect(aliasesFor(sandbox.path, '', { root: sandbox.path, sources: new Map(), memo: new Map() })).toStrictEqual({
        '@app/': 'src/',
    });
    const generated = emitAll(session).files;
    const compiler = generated.find((file) => file.path === '.gspot/config/tsconfig.json')!;
    const child = generated.find((file) => file.path === '.gspot/config/web/tsconfig.json')!;
    expect(JSON.parse(compiler.content)).toMatchObject({ extends: '../../tsconfig.json' });
    expect(JSON.parse(child.content)).toMatchObject({ extends: '../../../web/tsconfig.json' });
});

test('alias discovery accepts linked authored manifests and inherited compiler configurations inside the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'settings/manifest.json': '{"imports":{"#package/*":"./src/*"}}',
        'settings/compiler.json': '{"extends":"./settings/base.json"}',
        'settings/base.json': '{"compilerOptions":{"paths":{"#compiler/*":["../app/*"]}}}',
    });
    await symlink('settings/manifest.json', join(sandbox.path, 'package.json'));
    await symlink('settings/compiler.json', join(sandbox.path, 'tsconfig.json'));
    expect(aliasesFor(sandbox.path, '', { root: sandbox.path, sources: new Map(), memo: new Map() })).toStrictEqual({
        '#package/': 'src/',
        '#compiler/': 'app/',
    });
});

test('alias discovery reports a missing authored base by its filename', async () => {
    await using sandbox = await testdir({ 'tsconfig.json': '{"extends":"./missing-base.json"}' });
    expect(() => aliasesFor(sandbox.path, '', { root: sandbox.path, sources: new Map(), memo: new Map() })).toThrow(
        'missing-base.json',
    );
});

test('compiler configuration reads share one run snapshot and isolate roots and later runs', async () => {
    await using first = await testdir({
        'tsconfig.json': '{"extends":"./base.json"}',
        'base.json': '{"compilerOptions":{"strict":true}}',
    });
    await using second = await testdir({ 'tsconfig.json': '{"compilerOptions":{"strict":false}}' });
    const reads: ReadCache = { root: first.path, sources: new Map(), memo: new Map() };
    const path = join(first.path, 'tsconfig.json');
    const initial = getTsconfig(first.path, path, reads)!;
    expect(initial.options.strict).toBe(true);
    expect(getTsconfig(first.path, path, reads)).toBe(initial);
    expect(getTsconfig(second.path, join(second.path, 'tsconfig.json'), reads)?.options.strict).toBe(false);
    expect(() => getTsconfig(second.path, path, reads)).toThrow('Unsafe lifecycle path');
    await writeFile(join(first.path, 'base.json'), '{"compilerOptions":{"strict":false}}');
    expect(getTsconfig(first.path, path, reads)).toBe(initial);
    const next: ReadCache = { root: first.path, sources: new Map(), memo: new Map() };
    expect(getTsconfig(first.path, path, next)?.options.strict).toBe(false);
    await writeFile(join(first.path, 'base.json'), '{');
    const invalid: ReadCache = { root: first.path, sources: new Map(), memo: new Map() };
    expect(() => getTsconfig(first.path, path, invalid)).toThrow('Cannot read TypeScript configuration');
});
