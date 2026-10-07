// Resolve and install npm tool projects without writing credentials to lockfiles.
import { join } from 'node:path';
import { runTool } from '#cli/tools/run.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { SETUP } from '#cli/config/tools/install.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { yarnSettings } from '#cli/tools/npm/yarn.ts';
import { executableNames } from '#cli/platform/paths.ts';
import { toolVersionState } from '#cli/tools/inspect.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import { PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import { registryEnvironment } from '#cli/tools/npm/registry.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseVersionOutput } from '#cli/parsers/tool/version.ts';
import type { PackageInstaller } from '#cli/types/parsers/packages.ts';
import { isYarnBerry, packageLockfile } from '#cli/parsers/packages.ts';
import type { PackageRun, PackageExecution } from '#cli/types/tools/npm.ts';
import { stripBunRegistryUrls, stripYarnRegistryUrls } from '#cli/tools/npm/lockfiles.ts';

import {
    registryPasswords,
    addEnvironmentReference,
    installationDiagnostics,
    assertCredentialFreeLockfile,
} from '#cli/tools/credentials.ts';
import {
    CREDENTIAL_KEY,
    GITHUB_REFUSAL,
    YARN_ARGUMENTS,
    INSTALL_ARGUMENTS,
    CONNECTION_URL_KEY,
    LOCKFILE_ARGUMENTS,
    NPM_SETTING_PREFIX,
    GITHUB_DOWNLOAD_URL,
    ENCODED_CREDENTIAL_KEY,
    PACKAGE_SETTING_VARIABLE_PREFIX,
} from '#cli/config/tools/npm.ts';

// Retain raw, decoded, and URL-encoded secrets for lockfile validation and diagnostic redaction.
function credentialsOf(env: Record<string, string>): string[] {
    const credentials = Object.entries(env)
        .filter(([key]) => CREDENTIAL_KEY.test(key))
        .map(([, value]) => value)
        .filter((value) => value.length > 0);
    const encoded = Object.entries(env)
        .filter(([key]) => ENCODED_CREDENTIAL_KEY.test(key))
        .flatMap(([key, value]) => {
            const decoded = Buffer.from(value, 'base64').toString('utf8');
            return key.endsWith('_auth') ? [decoded, decoded.slice(decoded.indexOf(':') + 1)] : [decoded];
        });
    const passwords = Object.entries(env)
        .filter(([key]) => CONNECTION_URL_KEY.test(key))
        .flatMap(([, value]) => registryPasswords(value));
    return [...credentials, ...encoded, ...passwords];
}

// Native managers read environment references so the temporary .npmrc contains no credentials.
function writeNpmrc(work: string, env: Record<string, string>): void {
    const references: string[] = [];
    for (const [key, value] of Object.entries(env)) {
        if (!key.startsWith(NPM_SETTING_PREFIX)) continue;
        const reference = addEnvironmentReference(env, PACKAGE_SETTING_VARIABLE_PREFIX, value);
        references.push(`${key.slice(NPM_SETTING_PREFIX.length)}=${reference}`);
    }
    writeFileSync(join(work, '.npmrc'), `${references.join('\n')}\n`, { mode: PRIVATE_FILE });
}

// Declared and recorded versions are metadata; verify the executable in this scratch project before native work.
async function assertPackageInstallerVersion(execution: PackageExecution): Promise<void> {
    const { installer, work, env } = execution;
    const version = await runTool([installer.name, '--version'], { cwd: work, env });
    if (version.code !== 0 || version.stdout.trim() !== installer.version)
        throw new GspotError(
            'tool',
            `The tool project requires ${installer.name}@${installer.version}. Install that package manager version first.`,
        );
}

async function runPackageInstaller(
    root: string,
    work: string,
    installer: PackageInstaller,
    argv: string[],
): Promise<PackageRun> {
    const env = await registryEnvironment(root);
    const execution: PackageExecution = { work, installer, env };
    const credentials = credentialsOf(env);
    writeNpmrc(work, env);
    env['npm_config_userconfig'] = join(work, '.npmrc');
    if (isYarnBerry(installer)) {
        delete env['YARN_REGISTRY'];
        await assertPackageInstallerVersion(execution);
        credentials.push(...(await yarnSettings(root, work, env)));
    } else {
        await assertPackageInstallerVersion(execution);
    }
    const result = await runTool(argv, { cwd: work, env });
    return { execution, credentials, result };
}

function packageFailure(result: PackageRun['result'], credentials: string[]): string {
    const cause = githubRefusalNote(`${result.stdout}\n${result.stderr}`);
    const causeNote = cause === undefined ? '' : ` ${cause}`;
    return `(exit ${String(result.code)}). ${SETUP}.${causeNote}\n${installationDiagnostics(result, credentials)}`;
}

// Validate native lockfile output before it enters managed ownership.
function credentialFreeLockfile(execution: PackageExecution, credentials: string[]): string {
    const lockfile = readFileSync(join(execution.work, packageLockfile(execution.installer.name)), 'utf8');
    assertCredentialFreeLockfile(
        lockfile,
        credentials,
        new GspotError(
            'installation',
            'The package manager included registry credentials in its lockfile. Existing files were preserved.',
        ),
    );
    return lockfile;
}

// Private registry routing stays in the installation environment, out of portable lockfiles.
function stripRegistryUrls(execution: PackageExecution, lockfile: string): void {
    const { installer, work, env } = execution;
    const lockfilePath = join(work, packageLockfile(installer.name));
    if (installer.name === 'bun') writeFileSync(lockfilePath, stripBunRegistryUrls(lockfile, env));
    if (installer.name !== 'yarn' || isYarnBerry(installer)) return;
    const registry = env['npm_config_registry'];
    if (registry === undefined) throw new Error('A Yarn 1 lockfile needs npm_config_registry to relocate its URLs.');
    writeFileSync(lockfilePath, stripYarnRegistryUrls(lockfile, registry));
}

// An npm wrapper can declare a package version different from its native executable version.
function needsVersionCheck(tool: ToolPin, dependencies: Record<string, string>): boolean {
    const npm = tool.installers['npm'];
    if (tool.kind === 'library' || npm?.version === undefined || tool.version === undefined) return false;
    return npm.version !== tool.version && dependencies[npm.name] === npm.version;
}

async function assertNativeVersion(work: string, executable: string, tool: ToolPin): Promise<void> {
    const result = await runTool([executable, ...(tool.version_command ?? ['--version'])], {
        cwd: work,
        ...(tool.env === undefined ? {} : { env: tool.env }),
    });
    const read = parseVersionOutput(tool, result);
    if (!('version' in read)) throw new GspotError('installation', read.note);
    const want = tool.version ?? read.version;
    const floor = tool.min_version ?? want;
    if (toolVersionState(read.version, want, floor) === 'outdated')
        throw new GspotError(
            'installation',
            `${tool.name} reported ${read.version}, below ${floor}. No installed files were written.`,
        );
}

/**
 * Resolve the tool project's lockfile in an isolated directory before writing generated files.
 * @param root the repository whose connection settings apply
 * @param work the isolated tool project
 * @param installer the package manager and exact version declared by the project
 */
export async function preparePackageLockfile(root: string, work: string, installer: PackageInstaller): Promise<void> {
    const { execution, credentials, result } = await runPackageInstaller(
        root,
        work,
        installer,
        lockfileArgv(installer),
    );
    if (result.code !== 0)
        throw new GspotError(
            'installation',
            `${installer.name} lockfile resolution failed ${packageFailure(result, credentials)}`,
        );
    const lockfile = credentialFreeLockfile(execution, credentials);
    stripRegistryUrls(execution, lockfile);
}

/**
 * Install the recorded tool lockfile immutably in an isolated directory.
 * @param root the repository whose connection settings apply
 * @param work the isolated tool project and recorded lockfile
 * @param installer the package manager and exact version declared by the project
 */
export async function installPackageLockfile(root: string, work: string, installer: PackageInstaller): Promise<void> {
    const { execution, credentials, result } = await runPackageInstaller(root, work, installer, installArgv(installer));
    if (result.code !== 0)
        throw new GspotError(
            'installation',
            `${installer.name} immutable installation failed ${packageFailure(result, credentials)}`,
        );
    credentialFreeLockfile(execution, credentials);
}

/**
 * Checks each installed native wrapper whose package version differs from the tool's, before writing installed files.
 * @param work the scratch directory holding the installation
 * @param dependencies the dependencies the tool project declares
 * @param selected the pinned tools
 */
export async function assertPackageVersions(
    work: string,
    dependencies: Record<string, string>,
    selected: Iterable<ToolPin>,
): Promise<void> {
    using files = openRoot(work, 'native');
    // A Windows shim is a command file from npm or an executable from Bun; the first that exists is the wrapper.
    for (const tool of selected) {
        if (!needsVersionCheck(tool, dependencies)) continue;
        const name =
            executableNames(tool.name).find((candidate) => existsSync(join(work, 'node_modules', '.bin', candidate))) ??
            tool.name;
        await assertNativeVersion(work, files.realPath(`node_modules/.bin/${name}`), tool);
    }
}

/**
 * Build the manager's native lockfile creation command.
 * @param installer the declared package manager
 * @returns literal arguments for its Classic, Berry, or other native lockfile operation
 */
export function lockfileArgv(installer: PackageInstaller): string[] {
    if (installer.name !== 'yarn') return [...LOCKFILE_ARGUMENTS[installer.name]];
    const argv = isYarnBerry(installer) ? YARN_ARGUMENTS.berry : YARN_ARGUMENTS.classic;
    return [...argv.lockfile];
}

/**
 * Build the manager's native immutable installation command.
 * @param installer the declared package manager
 * @returns literal arguments for its Classic, Berry, or other native installation
 */
export function installArgv(installer: PackageInstaller): string[] {
    if (installer.name !== 'yarn') return [...INSTALL_ARGUMENTS[installer.name]];
    const argv = isYarnBerry(installer) ? YARN_ARGUMENTS.berry : YARN_ARGUMENTS.classic;
    return [...argv.install];
}

/**
 * The one line that names the cause of a failed package installation when the output shows it.
 * @param output what the package manager printed on both streams
 * @returns the note, or undefined when the output names no cause gspot knows
 */
export function githubRefusalNote(output: string): string | undefined {
    if (!output.split('\n').some((line) => GITHUB_DOWNLOAD_URL.test(line) && GITHUB_REFUSAL.test(line)))
        return undefined;
    return 'GitHub refused a tool download. Set GITHUB_TOKEN to a token that reads public releases and retry.';
}
