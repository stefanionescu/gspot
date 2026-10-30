import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { cp, symlink, readFile } from 'node:fs/promises';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { buildProgramArguments } from '#tests/setup/system/programs.ts';
import { BASH_MANIFEST, PACKAGE_FOLDER } from '#tests/config/system/system.ts';

async function writePackageFolder(folder: string): Promise<string> {
    const root = join(import.meta.dir, '../../../../..');
    await createFileTree(folder, {
        [`${PACKAGE_FOLDER}/tsconfig.json`]: JSON.stringify({
            compilerOptions: { paths: { '#cli/*': ['./packages/cli/src/*'] } },
        }),
        [`${PACKAGE_FOLDER}/packages/cli/package.json`]: await readFile(
            join(root, 'packages/cli/package.json'),
            'utf8',
        ),
        [`${PACKAGE_FOLDER}/packages/cli/configurations/language/bash/manifest.toml`]: BASH_MANIFEST,
        ...Object.fromEntries(
            Object.entries({
                'packages/cli/configurations/.index.json': '{}',
                'packages/cli/configurations/language/bash/.meta/state.json': '{}',
            }).map(([path, text]) => [`${PACKAGE_FOLDER}/${path}`, text]),
        ),
    });
    const cwd = join(folder, PACKAGE_FOLDER);
    const [program = ''] = buildProgramArguments('processes/assets');
    await cp(program, join(cwd, 'assets.ts'));
    await cp(join(root, 'packages/cli/src'), join(cwd, 'packages/cli/src'), { recursive: true });
    await symlink(join(root, 'packages/cli/node_modules'), join(cwd, 'packages/cli/node_modules'), 'junction');
    await symlink(join(root, 'node_modules'), join(cwd, 'node_modules'), 'junction');
    return cwd;
}

test('a package folder with spaces, percent signs, and Unicode reads and lists its assets', async () => {
    await using sandbox = await testdir();
    const cwd = await writePackageFolder(sandbox.path);
    const result = runCommandBlocking([process.execPath, '--no-install', join(cwd, 'assets.ts')], {
        cwd,
    });
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toStrictEqual({
        text: BASH_MANIFEST,
        files: [
            'configurations/.index.json',
            'configurations/language/bash/.meta/state.json',
            'configurations/language/bash/manifest.toml',
        ],
    });
});
