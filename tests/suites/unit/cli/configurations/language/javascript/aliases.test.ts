import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { readPackageAliases, readScopeAliases } from '#cli/configurations/language/javascript/aliases.ts';
import { createRunCache } from '#cli/system/cache.ts';

const ALIAS_PROJECT = {
    'package.json': '{"imports":{"#app/*":"./src/*","#root/*":"./root/*","#shared/*":"./package/*"}}',
    'tsconfig.json': '{"compilerOptions":{"paths":{"@root/*":["./typed/*"],"#shared/*":["./compiler/*"]}}}',
    'web/package.json': '{"imports":{"#app/*":"./src/*","#shared/*":"./package/*"}}',
    'web/tsconfig.json': '{"compilerOptions":{"paths":{"@web/*":["./typed/*"],"#shared/*":["./compiler/*"]}}}',
} as const;

const SCOPE_ALIASES = {
    '#app/*': 'src/*',
    '#root/*': 'root/*',
    '@root/*': 'typed/*',
    '#shared/*': 'compiler/*',
} as const;

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

test('package aliases skip browser conditions and package targets, and resolve nested ESM conditions in order', async () => {
    await using sandbox = await testdir({
        'package.json':
            '{"imports":{"#runtime":{"browser":"./browser.js","node":{"import":"./node.js"},"default":"./fallback.js"},"#ordered":{"default":"./first.js","node":"./later.js"},"#external":"lodash"}}',
    });
    expect(readPackageAliases(sandbox.path, '')).toStrictEqual({ '#runtime': 'node.js', '#ordered': 'first.js' });
});
