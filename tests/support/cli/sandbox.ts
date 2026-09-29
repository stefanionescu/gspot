// A planted repository with its private tools installed: the files, the selected kits, and the level each framework test starts from.
import { symlinkSync } from 'node:fs';
import { createFileTree } from 'testdirs';
import { join, delimiter } from 'node:path';
import { QUIET_INIT } from '#tests/inputs/cli.ts';
import type { Sandbox } from '#tests/types/cli.ts';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';

const MODULES = join(import.meta.dir, '../../../node_modules');

// The manifest a fixture with dependencies starts from.
function manifestOf(dependencies: Record<string, string> | undefined): Record<string, string> {
    if (dependencies === undefined) return {};
    const manifest = { name: 'planted', version: '1.0.0', private: true, type: 'module', dependencies };
    return { 'package.json': `${JSON.stringify(manifest, null, 4)}\n` };
}

// The init arguments: the kits, the recommendations left out, and the flags after them.
function initArgumentsOf(sandbox: Sandbox): string[] {
    const without = sandbox.without ?? ['naming', 'spelling'];
    const left = without.length === 0 ? [] : ['--without', ...without];
    return ['init', '--yes', '--kits', ...sandbox.kits, ...left, ...(sandbox.init ?? QUIET_INIT)];
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
    if (sandbox.modules !== false) symlinkSync(MODULES, join(root, 'node_modules'), 'dir');
    sandbox.before?.(root);
    commitAll(root);
    const tools = toolsPath(['typos', 'ec', 'ast-grep', ...(sandbox.tools ?? [])]);
    const environment = { PATH: `${join(MODULES, '.bin')}${delimiter}${tools}` };
    await install(root, initArgumentsOf(sandbox), environment);
    const level = sandbox.level ?? 'all';
    const selected = await run(root, ['set', 'level', level], environment);
    if (selected.code !== 0)
        throw new Error(`The ${level} level was not selected: ${selected.stdout}${selected.stderr}`);
    return environment;
}
