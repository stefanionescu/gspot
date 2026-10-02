// A planted repository with its private tools installed: the files, the selected kits, and the level each framework test starts from.
import { createFileTree } from 'testdirs';
import { join, delimiter } from 'node:path';
import { QUIET_INIT } from '#tests/inputs/cli.ts';
import type { Sandbox } from '#tests/types/cli.ts';
import { run } from '#tests/harness/cli/command.ts';
import { commitAll } from '#tests/harness/cli/git.ts';
import { INSTALLED_BIN_PATH } from '#tests/harness/cli/modules.ts';
import { install, toolsPath } from '#tests/harness/tools/install.ts';
import { linkInstalledModules } from '#tests/harness/cli/platforms.ts';

// The manifest a fixture with dependencies starts from.
function manifestOf(dependencies: Record<string, string> | undefined): Record<string, string> {
    if (dependencies === undefined) return {};
    const manifest = {
        name: 'planted',
        version: '1.0.0',
        private: true,
        description: 'A planted repository.',
        type: 'module',
        dependencies,
    };
    return { 'package.json': `${JSON.stringify(manifest, null, 4)}\n` };
}

/**
 * Plants a repository, installs its configurations and private tools, and returns the command environment.
 * @param root the empty sandbox
 * @param sandbox what the repository holds and selects
 * @returns the PATH every gspot command of the test runs with
 */
export async function installSandbox(
    root: string,
    sandbox: Sandbox & { before?: (root: string) => void },
): Promise<Record<string, string>> {
    await createFileTree(root, {
        '.gitignore': 'node_modules\n',
        ...manifestOf(sandbox.dependencies),
        ...sandbox.files,
    });
    if (sandbox.modules !== false) linkInstalledModules(join(root, 'node_modules'));
    sandbox.before?.(root);
    commitAll(root);
    const tools = toolsPath(['typos', 'ec', 'ast-grep', ...(sandbox.tools ?? [])]);
    const environment = { PATH: `${INSTALLED_BIN_PATH}${delimiter}${tools}` };
    const argv = ['init', '--yes', '--kits', ...sandbox.kits, ...(sandbox.init ?? QUIET_INIT)];
    await install(root, argv, environment, sandbox.without ?? ['naming', 'spelling']);
    const level = sandbox.level ?? 'all';
    const selected = await run(root, ['set', 'level', level], environment);
    if (selected.code !== 0)
        throw new Error(`The ${level} level was not selected: ${selected.stdout}${selected.stderr}`);
    return environment;
}
