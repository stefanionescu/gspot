// Running the package manager over the tool project in a scratch directory, with credentials kept out of its lock.
import semver from 'semver';
import { join } from 'node:path';
import type { ToolPin } from '#cli/types/kits.ts';
import { SETUP } from '#cli/config/tools/tools.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { InstallationError } from '#cli/tools/pins.ts';
import { PRIVATE_FILE } from '#cli/config/platform.ts';
import { runToolCommand } from '#cli/tools/command.ts';
import { yarnSettings } from '#cli/tools/packages/yarn.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { acquisitionNote } from '#cli/tools/packages/acquisition.ts';
import { packageEnvironment } from '#cli/tools/packages/environment.ts';
import { portableBunLock, relativeYarnLock } from '#cli/tools/packages/locks.ts';
import type { PackageTool, PackageExecution } from '#cli/types/tools/packages.ts';
import { MissingToolError, toolVersionState, observeToolVersion } from '#cli/tools/inspect.ts';
import { LOCKS, CREDENTIAL_KEY, YARN_BERRY_MAJOR, NPM_SETTING_PREFIX } from '#cli/config/tools/packages.ts';

// The resolve or install command of each manager that has one form, by whether the lock is frozen.
const COMMANDS: Record<Exclude<PackageTool['name'], 'yarn'>, (frozen: boolean) => string[]> = {
    npm: (frozen) => [
        'npm',
        ...(frozen ? ['ci'] : ['install', '--package-lock-only']),
        '--no-audit',
        '--no-fund',
        '--omit-lockfile-registry-resolved',
    ],
    bun: (frozen) => ['bun', 'install', frozen ? '--frozen-lockfile' : '--lockfile-only', '--linker', 'hoisted'],
    pnpm: (frozen) => [
        'pnpm',
        'install',
        frozen ? '--frozen-lockfile' : '--lockfile-only',
        '--ignore-workspace',
        '--node-linker=hoisted',
    ],
};

// Yarn's install command: Classic and Berry spell the frozen and lock-only modes differently.
function yarnCommand(client: PackageTool, frozen: boolean): string[] {
    if (semver.major(client.version) === 1) return ['yarn', 'install', ...(frozen ? ['--frozen-lockfile'] : [])];
    return ['yarn', 'install', ...(frozen ? ['--immutable'] : ['--mode=update-lockfile'])];
}

// Every secret the environment keeps: token and password settings, and passwords embedded in registry URLs.
function credentialsOf(env: Record<string, string>): string[] {
    const credentials = Object.entries(env)
        .filter(([key]) => CREDENTIAL_KEY.test(key))
        .map(([, value]) => value)
        .filter((value) => value.length > 0);
    for (const [key, value] of Object.entries(env)) {
        if (!key.toLowerCase().endsWith('registry')) continue;
        const registry = new URL(value);
        if (registry.password !== '') credentials.push(registry.password, decodeURIComponent(registry.password));
    }
    return credentials;
}

// Writes an .npmrc whose values the native clients read from the environment, so the file holds no credentials.
function writeSettings(work: string, env: Record<string, string>): void {
    const references: string[] = [];
    for (const [key, value] of Object.entries(env)) {
        if (!key.startsWith(NPM_SETTING_PREFIX)) continue;
        const variable = `GSPOT_PACKAGE_SETTING_${String(references.length)}`;
        env[variable] = value;
        references.push(`${key.slice(NPM_SETTING_PREFIX.length)}=\${${variable}}`);
    }
    writeFileSync(join(work, '.npmrc'), `${references.join('\n')}\n`, { mode: PRIVATE_FILE });
}

// Refuses a package manager other than the exact version the tool project names.
async function assertPackageToolVersion(execution: PackageExecution): Promise<void> {
    const { client, work, env } = execution;
    const version = await runToolCommand(undefined, [client.name, '--version'], { cwd: work, env });
    if (version.code !== 0 || version.stdout.trim() !== client.version)
        throw new MissingToolError(
            `The tool project requires ${client.name}@${client.version}. Install that package manager version first.`,
        );
}

// Runs the manager, failing with what went wrong and never with its output, which may carry credentials.
async function runPackageTool(execution: PackageExecution): Promise<void> {
    const { client, frozen, work, env } = execution;
    const result = await runToolCommand(undefined, packageInstallCommand(client, frozen), { cwd: work, env });
    if (result.code === 0) return;
    const cause = acquisitionNote(`${result.stdout}\n${result.stderr}`);
    const causeNote = cause === undefined ? '' : ` ${cause}`;
    const step = frozen ? 'immutable installation' : 'lock resolution';
    const text = `${client.name} ${step} failed (exit ${String(result.code)}). ${SETUP}. Registry credentials and package-manager output are not included.${causeNote}`;
    if (frozen) throw new InstallationError(text);
    throw new Error(text);
}

// Removes registry routing from a freshly resolved lock, which Bun and Yarn 1 write into it.
function relocateLock(execution: PackageExecution, lockPath: string, lock: string): void {
    const { client, frozen, env } = execution;
    if (frozen) return;
    if (client.name === 'bun') writeFileSync(lockPath, portableBunLock(lock, env));
    if (client.name !== 'yarn' || semver.major(client.version) !== 1) return;
    const registry = env['npm_config_registry'];
    if (registry === undefined) throw new Error('A Yarn 1 lockfile needs npm_config_registry to relocate its URLs.');
    writeFileSync(lockPath, relativeYarnLock(lock, registry));
}

// Whether a pinned executable's package prints a version other than the pin, so its wrapper must be checked.
function needsVersionCheck(tool: ToolPin, dependencies: Record<string, string>): boolean {
    const npm = tool.installers['npm'];
    if (tool.kind === 'library' || npm?.version === undefined || tool.version === undefined) return false;
    return npm.version !== tool.version && dependencies[npm.name] === npm.version;
}

// Runs an installed wrapper's version command and refuses one below the tool's floor.
async function assertNativeVersion(work: string, executable: string, tool: ToolPin): Promise<void> {
    const npm = tool.installers['npm'];
    const result = await runToolCommand(undefined, [executable, ...(tool.version_command ?? ['--version'])], {
        cwd: work,
        ...(tool.env === undefined ? {} : { env: tool.env }),
    });
    const observed = observeToolVersion(tool, result, npm?.version);
    if (!('version' in observed)) throw new InstallationError(observed.note);
    const want = tool.version ?? observed.version;
    const floor = tool.floor ?? want;
    if (toolVersionState(observed.version, want, floor) === 'outdated')
        throw new InstallationError(
            `${tool.name} reported ${observed.version}, below ${floor}. No installed files were published.`,
        );
}

/**
 * Resolves or installs the tool project in the scratch directory with the manager it names.
 * @param root the repository root, whose registry settings the manager runs with.
 * @param work the scratch directory holding the project.
 * @param client the package manager the project names.
 * @param frozen whether the recorded lock must be installed as is.
 */
export async function packageCommand(root: string, work: string, client: PackageTool, frozen: boolean): Promise<void> {
    const env = await packageEnvironment(root);
    const execution: PackageExecution = { root, work, client, frozen, env };
    const credentials = credentialsOf(env);
    writeSettings(work, env);
    if (client.name === 'yarn' && semver.major(client.version) >= YARN_BERRY_MAJOR) delete env['YARN_REGISTRY'];
    await assertPackageToolVersion(execution);
    if (client.name === 'yarn' && semver.major(client.version) >= YARN_BERRY_MAJOR)
        credentials.push(...(await yarnSettings(root, work, env)));
    await runPackageTool(execution);
    const lockPath = join(work, LOCKS[client.name]);
    const lock = readFileSync(lockPath, 'utf8');
    // Refuse credential-bearing locks before rewriting registry routing or publishing them.
    if (credentials.some((value) => lock.includes(value) || lock.includes(encodeURIComponent(value))))
        throw new Error(
            'The package manager included registry credentials in its lock. Existing files were preserved.',
        );
    relocateLock(execution, lockPath, lock);
}

/**
 * Checks each installed native wrapper whose package version differs from the tool's, before publishing.
 * @param work the scratch directory holding the installation
 * @param dependencies the dependencies the tool project declares
 * @param selected the pinned tools
 */
export async function prepareNativeWrappers(
    work: string,
    dependencies: Record<string, string>,
    selected: Iterable<ToolPin>,
): Promise<void> {
    const tools = [...new Map([...selected].map((tool) => [tool.name, tool])).values()];
    const files = openConfinedRoot(work, 'native');
    const suffix = process.platform === 'win32' ? '.cmd' : '';
    try {
        for (const tool of tools.filter((candidate) => needsVersionCheck(candidate, dependencies)))
            await assertNativeVersion(work, files.source(`node_modules/.bin/${tool.name}${suffix}`), tool);
    } finally {
        files.close();
    }
}

/**
 * The command that resolves or installs the tool project with the manager.
 * @param client the package manager the project names
 * @param frozen whether the recorded lock must be installed as is
 * @returns the command
 */
export function packageInstallCommand(client: PackageTool, frozen: boolean): string[] {
    if (client.name === 'yarn') return yarnCommand(client, frozen);
    return COMMANDS[client.name](frozen);
}
