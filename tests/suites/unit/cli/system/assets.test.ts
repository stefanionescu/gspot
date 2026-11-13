import { cp, readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { BASH_MANIFEST } from '#tests/config/system.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

const PACKAGE_FOLDER = 'workspace % café';

async function writePackageFolder(folder: string): Promise<string> {
    const root = join(import.meta.dir, '../../../../..');
    await createFileTree(folder, {
        [`${PACKAGE_FOLDER}/tsconfig.json`]: JSON.stringify({
            compilerOptions: {
                paths: {
                    '#cli/*': ['./packages/cli/src/*'],
                    '#cli-package': ['./packages/cli/package.json'],
                },
            },
        }),
        [`${PACKAGE_FOLDER}/packages/cli/package.json`]: await readFile(
            join(root, 'packages/cli/package.json'),
            'utf8',
        ),
        [`${PACKAGE_FOLDER}/packages/cli/src/configurations/language/bash/manifest.toml`]: BASH_MANIFEST,
        ...Object.fromEntries(
            Object.entries({
                'packages/cli/src/configurations/.index.json': '{}',
                'packages/cli/src/configurations/language/bash/.meta/state.json': '{}',
            }).map(([path, text]) => [`${PACKAGE_FOLDER}/${path}`, text]),
        ),
    });
    const cwd = join(folder, PACKAGE_FOLDER);
    const [, program = ''] = buildProgramCommand('processes/assets');
    await cp(program, join(cwd, 'assets.ts'));
    await cp(join(root, 'packages/cli/src'), join(cwd, 'packages/cli/src'), {
        recursive: true,
        filter: (source) => !source.startsWith(join(root, 'packages/cli/src/configurations')),
    });
    await symlink(join(root, 'packages/cli/node_modules'), join(cwd, 'packages/cli/node_modules'), 'junction');
    await symlink(join(root, 'node_modules'), join(cwd, 'node_modules'), 'junction');
    return cwd;
}

test('a package folder with spaces, percent signs, and Unicode reads and lists its assets', async () => {
    await using sandbox = await testdir();
    const cwd = await writePackageFolder(sandbox.path);
    const result = runBlockingCommand([process.execPath, '--no-install', join(cwd, 'assets.ts')], {
        cwd,
    });
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toStrictEqual({
        text: BASH_MANIFEST,
        files: [
            'src/configurations/.index.json',
            'src/configurations/language/bash/.meta/state.json',
            'src/configurations/language/bash/manifest.toml',
        ],
    });
});
