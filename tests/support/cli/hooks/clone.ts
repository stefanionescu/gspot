import { chmodSync } from 'node:fs';
import { createFileTree } from 'testdirs';
import { join, delimiter } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import type { SpawnResult } from '#cli/types/platform.ts';
import { cliSource } from '#tests/support/cli/process.ts';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { PrepareHookCloneResult } from '#tests/types/results.ts';

const CLONE_HOOK_FILES = {
    'pre-commit': {
        'pyproject.toml':
            '[project]\nname = "hook-fixture"\nversion = "0.0.0"\nrequires-python = ">=3.11"\ndependencies = ["pre-commit==4.5.1"]\n',
        '.pre-commit-config.yaml':
            "repos:\n  - repo: local\n    hooks:\n      - id: authored\n        name: authored\n        entry: sh -c 'printf authored >> .hook-observed'\n        language: system\n        stages: [pre-commit]\n        pass_filenames: false\n        always_run: true\n",
    },
    lefthook: {
        'package.json': JSON.stringify({ private: true, devDependencies: { lefthook: '2.0.13' } }) + '\n',
        'lefthook.yml': 'pre-commit:\n  commands:\n    authored:\n      run: printf authored >> .hook-observed\n',
    },
    husky: {
        'package.json': JSON.stringify({ private: true, devDependencies: { husky: '9.1.7' } }) + '\n',
        '.husky/pre-commit': 'printf authored >> .hook-observed\nexit 0\n',
    },
    'simple-git-hooks': {
        'package.json':
            JSON.stringify({
                private: true,
                devDependencies: { 'simple-git-hooks': '2.13.1' },
                'simple-git-hooks': { 'pre-commit': 'printf authored >> .hook-observed' },
            }) + '\n',
    },
};
const CLONE_POLICY = `version = 1
kits = []
[guides]
install = false
[hooks]
tool = "%HOOK_TOOL%"
[[check]]
name = "fixture/source"
command = [${JSON.stringify(process.execPath)}, "check-source.mjs", "{files}"]
paths = ["source.txt"]
stage = "commit"
summary = "Rejects forbidden source text."
help = "Remove the forbidden token."
[check.output]
format = "lines"
`;

/** Creates a committed hook project and a fresh clone with no local installation state. */
export async function prepareHookClone(
    repository: string,
    clonePath: string,
    hookTool: keyof typeof CLONE_HOOK_FILES,
): Promise<PrepareHookCloneResult> {
    const main = cliSource('main.ts');
    await createFileTree(repository, {
        '.gitignore': 'node_modules/\n.venv/\npre-commit-cache/\n.hook-observed\n',
        ...CLONE_HOOK_FILES[hookTool],
        'gspot.toml': CLONE_POLICY.replace('%HOOK_TOOL%', hookTool),
        'source.txt': 'allowed\n',
        'check-source.mjs':
            'for (const path of process.argv.slice(2)) { if ((await Bun.file(path).text()).includes("forbidden")) { console.log(`${path}:1:1: forbidden source token`); process.exitCode = 1; } }\n',
        'bin/gspot': `#!${process.execPath}\nconst child = Bun.spawnSync([process.execPath, ${JSON.stringify(main)}, ...process.argv.slice(2)], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }); process.exit(child.exitCode);\n`,
    });
    chmodSync(join(repository, 'bin/gspot'), 0o755);
    for (const command of [
        ['git', 'init', '--quiet'],
        ...(hookTool === 'pre-commit'
            ? [
                  ['uv', 'lock'],
                  ['uv', 'sync', '--frozen', '--no-install-project'],
              ]
            : [['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund']]),
    ]) {
        const result = await run(command, { cwd: repository, timeoutMs: 60_000 });
        if (result.code !== 0) throw new Error(`Hook clone fixture setup failed: ${result.stdout}${result.stderr}`);
    }
    const reapplied = await applyCommand({ cwd: repository, isDryRun: false });
    if (reapplied.exitCode !== 0) throw new Error('Hook clone fixture apply failed.');
    for (const command of [
        ['git', 'add', '--all'],
        ['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture'],
        ['git', 'clone', '--quiet', '--no-local', repository, clonePath],
    ]) {
        const result = await run(command, { cwd: repository });
        if (result.code !== 0) throw new Error(`Hook clone fixture setup failed: ${result.stdout}${result.stderr}`);
    }
    const options = {
        cwd: clonePath,
        timeoutMs: 30_000,
        env: {
            PATH: `${join(clonePath, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
            XDG_CONFIG_HOME: join(clonePath, 'fixture-config'),
            PRE_COMMIT_HOME: join(clonePath, 'pre-commit-cache'),
        },
    };
    return {
        main,
        options,
        clonePath,
        hookTool,
    };
}

/** Installs the clone's locked dependencies before invoking the public hook installation command. */
export async function installHookClone(clone: Awaited<ReturnType<typeof prepareHookClone>>): Promise<SpawnResult> {
    const { hookTool, main, clonePath } = clone;
    const installed = await run(
        hookTool === 'pre-commit'
            ? ['uv', 'sync', '--frozen', '--no-install-project']
            : ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'],
        { cwd: clonePath, timeoutMs: 60_000 },
    );
    if (installed.code !== 0)
        throw new Error(`Cloned hook dependencies failed: ${installed.stdout}${installed.stderr}`);
    return await run([process.execPath, main, 'install'], { cwd: clonePath, timeoutMs: 60_000 });
}
