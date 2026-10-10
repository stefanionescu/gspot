import which from 'which';
import semver from 'semver';
import Config from '@npmcli/config';
import { join, dirname, resolve } from 'node:path';
import { SETUP } from '#cli/config/tools/install.ts';
import { yarnSettings } from '#cli/tools/npm/yarn.ts';
import type { ToolPin } from '#cli/types/parsers/tool.ts';
import { PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { parseVersionOutput } from '#cli/parsers/tool/contracts.ts';
import npmDefinitions from '@npmcli/config/lib/definitions/index.js';
import { isRecord, executableNames } from '#cli/platform/contracts.ts';
import type { PackageInstaller } from '#cli/types/parsers/packages.ts';
import { sourcePath, canonicalPath } from '#cli/platform/root/reads.ts';
import { GspotError, environmentVariables } from '#cli/platform/public.ts';
import type { PackageRun, PackageCommands } from '#cli/types/tools/npm.ts';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isYarnBerry, packageLockfile, getPackageInstallerMajor } from '#cli/parsers/packages/contracts.ts';

import {
    runTool,
    toolVersionState,
    registryPasswords,
    addEnvironmentReference,
    installationDiagnostics,
    assertCredentialFreeLockfile,
} from '#cli/tools/contracts.ts';
import {
    CREDENTIAL_KEY,
    GITHUB_REFUSAL,
    YARN_ARGUMENTS,
    CONNECTION_KEYS,
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
function assertPackageInstallerVersion(installer: PackageInstaller, version: SpawnResult): void {
    const requirement = `${String(getPackageInstallerMajor(installer))}.x`;
    if (version.code !== 0 || !semver.satisfies(version.stdout.trim(), requirement, { includePrerelease: true }))
        throw new GspotError(
            'tool',
            `The tool project requires ${installer.name}@${requirement}. Install that package manager version first.`,
        );
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

// Read and validate the native configuration before exposing its effective registry settings.
async function readRegistrySettings(root: string): Promise<Record<string, unknown>> {
    const inherited = environmentVariables();
    const npm = which.sync('npm', { nothrow: true });
    const npmPath = npm === null ? dirname(process.execPath) : dirname(dirname(realpathSync(npm)));
    const config = new Config({
        npmPath,
        definitions: npmDefinitions.definitions,
        flatten: npmDefinitions.flatten,
        shorthands: npmDefinitions.shorthands,
        argv: [],
        env: inherited,
        cwd: root,
    });
    try {
        await config.load();
    } catch {
        throw new GspotError(
            'installation',
            'Cannot load the repository registry settings. Check the package manager configuration.',
        );
    }
    let valid: boolean;
    try {
        valid = config.validate();
    } catch (error) {
        if (isRecord(error) && error['code'] === 'ERR_INVALID_URL')
            throw new GspotError('installation', 'Invalid registry URL in package manager configuration.');
        throw error;
    }
    if (!valid) throw new GspotError('installation', 'Invalid package manager configuration.');
    const effective: Record<string, unknown> = {};
    for (const layer of config.list.toReversed()) Object.assign(effective, layer);
    return effective;
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
    const root = canonicalPath(work);
    // A Windows shim is a command file from npm or an executable from Bun; the first that exists is the wrapper.
    for (const tool of selected) {
        if (!needsVersionCheck(tool, dependencies)) continue;
        const name =
            executableNames(tool.name).find((candidate) => existsSync(join(work, 'node_modules', '.bin', candidate))) ??
            tool.name;
        await assertNativeVersion(work, sourcePath(root, `node_modules/.bin/${name}`), tool);
    }
}

/**
 * The native resolution and immutable-install argv for the selected package manager.
 * @param installer the declared package manager and major
 * @returns both actual package operations
 */
export function packageInstallerCommands(installer: PackageInstaller): PackageCommands {
    const yarn = isYarnBerry(installer) ? YARN_ARGUMENTS.berry : YARN_ARGUMENTS.classic;
    const args =
        installer.name === 'yarn'
            ? yarn
            : { lockfile: LOCKFILE_ARGUMENTS[installer.name], install: INSTALL_ARGUMENTS[installer.name] };
    return { lockfile: [...args.lockfile], install: [...args.install] };
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

/**
 * Read npm-compatible connection settings through the npm configuration owner, keeping credentials in memory.
 * @param root the repository root
 * @returns the environment variables that carry the registry settings
 */
export async function registryEnvironment(root: string): Promise<Record<string, string>> {
    const effective = await readRegistrySettings(root);
    const env: Record<string, string> = Object.fromEntries(
        Object.entries(effective)
            .filter(
                ([key]) =>
                    CONNECTION_KEYS.has(key) ||
                    /^@[^\s:=]+:registry$/u.test(key) ||
                    /^\/\/[^\s]+:(?:_authToken|_auth|username|_password|certfile|keyfile)$/u.test(key),
            )
            .flatMap(([key, value]): [string, string][] => {
                if (value === undefined || value === null) return [];
                let text: string;
                if (Array.isArray(value)) text = value.join('\n\n');
                else text = typeof value === 'string' ? value : JSON.stringify(value);
                if (key.endsWith(':certfile') || key.endsWith(':keyfile')) text = resolve(root, text);
                return [[`npm_config_${key}`, text]];
            }),
    );
    const registry = env['npm_config_registry'];
    if (registry !== undefined) {
        env['BUN_CONFIG_REGISTRY'] = registry;
        env['YARN_REGISTRY'] = registry;
    }
    return env;
}

/**
 * Execute a native package operation and validate its complete lockfile before publication.
 * @param root the repository whose connection settings apply
 * @param work the isolated native project
 * @param installer the native package manager requirement.
 * @param argv the lockfile or immutable-install command
 * @param failure the operation's failure description
 * @returns validated lockfile bytes and the private routing environment
 */
export async function runPackageInstaller(
    root: string,
    work: string,
    installer: PackageInstaller,
    argv: string[],
    failure: string,
): Promise<PackageRun> {
    const env = await registryEnvironment(root);
    const credentials = credentialsOf(env);
    writeNpmrc(work, env);
    env['npm_config_userconfig'] = join(work, '.npmrc');
    const berry = isYarnBerry(installer);
    if (berry) delete env['YARN_REGISTRY'];
    const version = await runTool([installer.name, '--version'], { cwd: work, env });
    assertPackageInstallerVersion(installer, version);
    if (berry) credentials.push(...(await yarnSettings(root, work, env)));
    const result = await runTool(argv, { cwd: work, env });
    if (result.code !== 0) {
        const cause = githubRefusalNote(`${result.stdout}\n${result.stderr}`);
        const causeNote = cause === undefined ? '' : ` ${cause}`;
        throw new GspotError(
            'installation',
            `${installer.name} ${failure} (exit ${String(result.code)}). ${SETUP}.${causeNote}\n${installationDiagnostics(result, credentials)}`,
        );
    }
    const lockfile = readFileSync(join(work, packageLockfile(installer.name)), 'utf8');
    assertCredentialFreeLockfile(
        lockfile,
        credentials,
        new GspotError(
            'installation',
            'The package manager included registry credentials in its lockfile. Existing files were preserved.',
        ),
    );
    return { env, lockfile };
}
