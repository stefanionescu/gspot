import { z } from 'zod';
import semver from 'semver';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { binaryPath } from '#cli/platform/assets.ts';
import { runToolCommand } from '#cli/tools/command.ts';
import type { Policy } from '#cli/types/policy/policy.ts';
import type { FileSnapshot } from '#cli/types/platform.ts';
import { installHooks } from '#cli/lifecycle/hooks/git.ts';
import type { ToolContext } from '#cli/types/tools/tools.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { nativeHook } from '#cli/lifecycle/hooks/native-hooks.ts';
import type { Repository } from '#cli/types/repository/repository.ts';
import { preCommitConfiguration } from '#cli/generation/pre-commit.ts';
import { CONFIG_PATHS, MANAGERS } from '#cli/constants/lifecycle/hooks.ts';
import { hasConfiguration } from '#cli/lifecycle/configuration-document.ts';
import { hookPrefix, lefthookConfiguration } from '#cli/generation/hooks.ts';
import { huskyReady, simpleGitHooksReady } from '#cli/lifecycle/hooks/state.ts';
import { HOOK_FILES, LEFTHOOK_MIN_VERSION } from '#cli/constants/repository/repository.ts';
import type { HookManager, Preparation, PreparedHook } from '#cli/types/lifecycle/hooks.ts';

// The native manager the policy names, when Git is present and the tool is one gspot integrates with.
function managerOf(policy: Policy, repository: Pick<Repository, 'hasGit'>): HookManager | undefined {
    const tool = policy.hooks?.tool;
    if (!repository.hasGit || tool === undefined || !MANAGERS.has(tool)) return undefined;
    return tool as HookManager;
}

// Whether the manager's integration, which gspot apply writes, is in place and unedited.
function isIntegrationReady(manager: HookManager, policy: Policy, root: string): boolean {
    const runner = policy.runner?.tool;
    const binary = binaryPath();
    if (manager === 'husky') return huskyReady(root, runner, binary);
    if (manager === 'simple-git-hooks') return simpleGitHooksReady(root, runner, binary);
    const configuration =
        manager === 'lefthook'
            ? lefthookConfiguration(root, runner, binary)
            : preCommitConfiguration(root, runner, binary);
    return hasConfiguration(root, configuration);
}

// The manager's executable, found through the repository's tools and, for Lefthook, new enough to be safe.
function managerExecutable(manager: HookManager, tools: ToolContext): string {
    const tool = inspectTool(tools, {
        name: manager,
        provider: 'host',
        windows: true,
        installers: {},
        ...(manager === 'lefthook' ? { version_command: ['version'] } : {}),
    });
    if (tool.path === undefined)
        throw new Error(`Install the repository ${manager} dependency, then run gspot install.`);
    if (manager === 'lefthook' && (tool.found === undefined || semver.lt(tool.found, LEFTHOOK_MIN_VERSION)))
        throw new Error(
            `Install Lefthook ${LEFTHOOK_MIN_VERSION} or newer to keep native hooks from replacing the installed dispatcher, then run gspot install.`,
        );
    return tool.path;
}

// Lefthook's configuration as its own dump resolves it, without the sources a temporary root cannot load again.
async function dumpedLefthookConfiguration(root: string, executable: string, mode: number): Promise<FileSnapshot> {
    const dumped = await runToolCommand(undefined, [executable, 'dump', '--format', 'json'], { cwd: root });
    if (dumped.code !== 0)
        throw new Error('Cannot load Lefthook configuration. Correct it before running gspot install.');
    let resolved: Record<string, unknown>;
    try {
        resolved = z.record(z.string(), z.unknown()).parse(JSON.parse(dumped.stdout));
    } catch (error) {
        throw new Error('Cannot load Lefthook configuration. Correct it before running gspot install.', {
            cause: error,
        });
    }
    // Native dump resolves these sources; preparation must not load them again from its temporary root.
    for (const field of ['extends', 'remotes', 'remote']) Reflect.deleteProperty(resolved, field);
    return { bytes: Buffer.from(JSON.stringify(resolved)), mode };
}

// The configuration file the manager reads in the prepared directory, or undefined for Husky, which reads none.
async function managerConfiguration(
    manager: HookManager,
    root: string,
    configPath: string,
    executable: string,
): Promise<FileSnapshot | undefined> {
    if (manager === 'husky') return undefined;
    const source = openConfinedRoot(root);
    let configuration: FileSnapshot | undefined;
    try {
        configuration = source.read(configPath);
    } finally {
        source.close();
    }
    if (configuration === undefined) throw new Error(`${manager} requires ${configPath}.`);
    if (manager !== 'lefthook') return configuration;
    return dumpedLefthookConfiguration(root, executable, configuration.mode);
}

// The commands that make the manager generate its hooks in the prepared directory.
function preparationCommands(preparation: Preparation): string[][] {
    const { manager, executable, installedConfig } = preparation;
    const commands = [['git', 'init', '-q']];
    if (manager === 'pre-commit') commands.push([executable, 'validate-config', installedConfig]);
    if (manager === 'lefthook') commands.push([executable, 'install']);
    else if (manager === 'pre-commit')
        commands.push([
            executable,
            'install',
            '--config',
            installedConfig,
            ...HOOK_FILES.flatMap((name) => ['--hook-type', name]),
        ]);
    else commands.push([executable]);
    return commands;
}

// The hooks the manager generated, each paired with the hook gspot installs for it.
async function prepareHooks(
    preparation: Preparation,
    configuration: FileSnapshot | undefined,
): Promise<Map<string, PreparedHook>> {
    const { manager, files, work } = preparation;
    const env = {
        ...(manager === 'husky' ? { HUSKY: '1' } : {}),
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'core.hooksPath',
        GIT_CONFIG_VALUE_0: manager === 'lefthook' ? '.git/hooks' : '',
    };
    if (configuration !== undefined) files.write(preparation.installedConfig, configuration, undefined);
    for (const argv of preparationCommands(preparation)) {
        const result = await runToolCommand(undefined, argv, { cwd: work, env });
        if (result.code !== 0)
            throw new Error(`Hook manager preparation failed: ${result.stderr.trim() || result.stdout.trim()}`);
    }
    const names =
        manager === 'lefthook' ? files.list('.git/hooks').filter((name) => !name.endsWith('.sample')) : HOOK_FILES;
    return new Map(names.map((name) => [name, nativeHook(preparation, name)]));
}

/**
 * Generate native manager hooks in an isolated Git directory, then publish through the lifecycle owner.
 * @param options the policy, the repository, and the tools the manager runs with
 * @param options.policy the repository policy
 * @param options.repository the repository root and whether Git is present
 * @param options.tools the tool context that finds the manager's executable
 * @returns the line that says what was installed, or '' when no native manager owns the hooks
 */
export async function installHookManager({
    policy,
    repository,
    tools,
}: {
    policy: Policy;
    repository: Pick<Repository, 'root' | 'hasGit'>;
    tools: ToolContext;
}): Promise<string> {
    const manager = managerOf(policy, repository);
    if (manager === undefined) return '';
    if (!isIntegrationReady(manager, policy, repository.root))
        throw new Error(`${manager} integration is missing or edited. Run gspot apply before installing.`);
    const executable = managerExecutable(manager, tools);
    const configPath =
        manager === 'lefthook'
            ? lefthookConfiguration(repository.root, policy.runner?.tool, binaryPath()).path
            : CONFIG_PATHS[manager];
    const configuration = await managerConfiguration(manager, repository.root, configPath, executable);
    const installedConfig = manager === 'pre-commit' ? `${hookPrefix(repository.root)}${configPath}` : configPath;
    const work = mkdtempSync(join(tmpdir(), 'gspot-hook-manager-'));
    const files = openConfinedRoot(work);
    try {
        const preparation: Preparation = {
            manager,
            policy,
            root: repository.root,
            executable,
            installedConfig,
            work,
            files,
        };
        const generated = await prepareHooks(preparation, configuration);
        return installHooks({ policy, repository }, generated);
    } finally {
        files.close();
        rmSync(work, { recursive: true, force: true });
    }
}
