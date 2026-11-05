import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { readPackageAliases, readScopeAliases } from '#cli/repository/javascript/aliases.ts';
import { createRunCache } from '#cli/system/cache.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { ALIAS_PROJECT, SCOPE_ALIASES } from '#tests/config/repository/detect.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('alias reads report a malformed tsconfig.json', async () => {
    await using sandbox = await testdir({ 'tsconfig.json': '{ "compilerOptions": { "paths": {} },' });
    expect(() => readScopeAliases(sandbox.path, '', createRunCache(sandbox.path))).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'configuration',
            message: expect.stringContaining('tsconfig.json') as string,
        }),
    );
});

test('root and child aliases read their own files, and tsconfig paths win', async () => {
    await using sandbox = await testdir(ALIAS_PROJECT);
    expect(readScopeAliases(sandbox.path, '', createRunCache(sandbox.path))).toStrictEqual(SCOPE_ALIASES);
    expect(readScopeAliases(sandbox.path, 'web', createRunCache(sandbox.path))).toStrictEqual({
        '#app/*': 'web/src/*',
        '@web/*': 'web/typed/*',
        '#shared/*': 'web/compiler/*',
    });
});

test('inherited aliases are read relative to the file that declares them', async () => {
    await using sandbox = await testdir({
        'tsconfig.json': '{"extends":"./configs/tsconfig.json"}',
        'configs/tsconfig.json': '{"compilerOptions":{"paths":{"@app/*":["../src/*"]}}}',
    });

    expect(readScopeAliases(sandbox.path, '', createRunCache(sandbox.path))).toStrictEqual({
        '@app/*': 'src/*',
    });
    await writeFile(
        join(sandbox.path, 'configs/tsconfig.json'),
        '{"compilerOptions":{"baseUrl":"../app","paths":{"@app/*":["src/*"]}}}',
    );
    expect(readScopeAliases(sandbox.path, '', createRunCache(sandbox.path))).toStrictEqual({
        '@app/*': 'app/src/*',
    });
});

test('alias reads name a missing extended file', async () => {
    await using sandbox = await testdir({ 'tsconfig.json': '{"extends":"./missing-base.json"}' });
    const missing = convertToPosixPath(join(sandbox.path, 'missing-base.json'));
    expect(() => readScopeAliases(sandbox.path, '', createRunCache(sandbox.path))).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'configuration',
            message: expect.stringContaining(missing) as string,
        }),
    );
});

test('package aliases skip browser conditions and resolve nested ESM conditions in order', async () => {
    await using sandbox = await testdir({
        'package.json':
            '{"imports":{"#runtime":{"browser":"./browser.js","node":{"import":"./node.js"},"default":"./fallback.js"},"#ordered":{"default":"./first.js","node":"./later.js"}}}',
    });
    expect(readPackageAliases(sandbox.path, '')).toStrictEqual({ '#runtime': 'node.js', '#ordered': 'first.js' });
});
