// A planted repository with its private tools installed: the files, the selected configurations, and the level each framework test starts from.
import { symlinkSync } from 'node:fs';
import { createFileTree } from 'testdirs';
import { delimiter, join } from 'node:path';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import type { Sandbox } from '#tests/types/support/cli.ts';
import { QUIET_INIT } from '#tests/constants/support/cli.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';

const MODULES = join(import.meta.dir, '../../../node_modules');

/**
 * Plants a repository, installs its configurations and private tools, and returns the command environment.
 * @param root the empty sandbox
 * @param sandbox what the repository holds and selects
 * @returns the PATH every gspot command of the test runs with
 */
export async function installSandbox(root: string, sandbox: Sandbox): Promise<Record<string, string>> {
    const manifest =
        sandbox.dependencies === undefined
            ? {}
            : {
                  'package.json': `${JSON.stringify(
                      {
                          name: 'planted',
                          version: '1.0.0',
                          private: true,
                          type: 'module',
                          dependencies: sandbox.dependencies,
                      },
                      null,
                      4,
                  )}\n`,
              };
    await createFileTree(root, { '.gitignore': 'node_modules\n', ...manifest, ...sandbox.files });
    symlinkSync(MODULES, join(root, 'node_modules'));
    commitAll(root);
    const environment = { PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}` };
    const without = ['naming', 'spelling', ...(sandbox.without ?? [])];
    const argv = [
        'init',
        '--yes',
        '--configurations',
        ...sandbox.configurations,
        '--without',
        ...without,
        ...QUIET_INIT,
    ];
    await install(root, argv, environment);
    const level = sandbox.level ?? 'all';
    const selected = await run(root, ['set', 'level', level], environment);
    if (selected.code !== 0)
        throw new Error(`The ${level} level was not selected: ${selected.stdout}${selected.stderr}`);
    return environment;
}
