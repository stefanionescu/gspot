import { z } from 'zod';
import semver from 'semver';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as parseYaml } from 'yaml';
import { parseSyml } from '@yarnpkg/parsers';
import { isDeepStrictEqual } from 'node:util';
import { runToolCommand } from '#cli/tools/command.ts';
import { yarnSettings } from '#cli/tools/packages/yarn.ts';
import type { GeneratedFile } from '#cli/lifecycle/apply.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { ToolPin } from '#cli/configurations/manifests.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import type { LifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { acquisitionNote } from '#cli/tools/packages/acquisition.ts';
import { parsePackageManager } from '#cli/tools/packages/manager.ts';
import { publishInstalledFiles } from '#cli/tools/installed-files.ts';
import { applyEdits, modify, parse as parseJsonc } from 'jsonc-parser';
import { packageEnvironment } from '#cli/tools/packages/environment.ts';
import { InstallationError, MissingToolError } from '#cli/tools/errors.ts';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { observeToolVersion, toolVersionState } from '#cli/tools/probe.ts';

const PROJECT = '.gspot/package.json';
const SETUP = 'Run: gspot apply, then gspot install';
const packageSchema = z.strictObject({
    name: z.literal('gspot-tools'),
    private: z.literal(true),
    type: z.literal('module'),
    packageManager: z.string(),
    devDependencies: z.record(
        z.string(),
        z.string().refine((value) => semver.valid(value) !== null),
    ),
});
const LOCKS = { npm: 'package-lock.json', bun: 'bun.lock', pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock' } as const;

async function prepareNativeWrappers(
    work: string,
    dependencies: Record<string, string>,
    selected: Iterable<ToolPin>,
): Promise<void> {
    const tools = new Map([...selected].map((tool) => [tool.name, tool]));
    const files = openConfinedRoot(work, 'native');
    try {
        for (const tool of tools.values()) {
            const npm = tool.installers['npm'];
            if (
                tool.kind === 'library' ||
                npm?.version === undefined ||
                tool.version === undefined ||
                npm.version === tool.version ||
                dependencies[npm.name] !== npm.version
            )
                continue;
            const executable = files.source(
                `node_modules/.bin/${tool.name}${process.platform === 'win32' ? '.cmd' : ''}`,
            );
            const result = await runToolCommand(undefined, [executable, ...(tool.version_command ?? ['--version'])], {
                cwd: work,
                ...(tool.env === undefined ? {} : { env: tool.env }),
            });
            const observed = observeToolVersion(tool, result, npm.version);
            if (!('version' in observed)) throw new InstallationError(observed.note);
            if (toolVersionState(observed.version, tool.version, tool.floor ?? tool.version) === 'outdated')
                throw new InstallationError(
                    `${tool.name} reported ${observed.version}, below ${tool.floor ?? tool.version}. No installed files were published.`,
                );
        }
    } finally {
        files.close();
    }
}

function lockMatches(name: keyof typeof LOCKS, content: string, dependencies: Record<string, string>): boolean {
    if (/^(?:<{7}|={7}|>{7})/mu.test(content)) return false;
    try {
        let actual: unknown;
        switch (name) {
            case 'npm': {
                actual = z
                    .object({
                        packages: z.record(
                            z.string(),
                            z.object({ devDependencies: z.record(z.string(), z.string()).optional() }),
                        ),
                    })
                    .parse(JSON.parse(content)).packages['']?.devDependencies;
                break;
            }
            case 'bun': {
                actual = z
                    .object({
                        workspaces: z.record(
                            z.string(),
                            z.object({ devDependencies: z.record(z.string(), z.string()).optional() }),
                        ),
                    })
                    .parse(parseJsonc(content)).workspaces['']?.devDependencies;
                break;
            }
            case 'pnpm': {
                const pinned = z
                    .object({ importers: z.record(z.string(), z.object({ devDependencies: z.unknown() })) })
                    .parse(parseYaml(content)).importers['.']?.devDependencies;
                const entries = z.record(z.string(), z.object({ specifier: z.string() })).parse(pinned);
                actual = Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, value.specifier]));

                break;
            }
            default: {
                const entries = z
                    .record(z.string(), z.looseObject({ version: z.string().optional() }))
                    .parse(parseSyml(content));
                return Object.entries(dependencies).every(([dependency, version]) =>
                    Object.entries(entries).some(
                        ([descriptors, entry]) =>
                            descriptors
                                .split(/,\s*/u)
                                .some(
                                    (descriptor) =>
                                        descriptor === `${dependency}@${version}` ||
                                        descriptor === `${dependency}@npm:${version}`,
                                ) && entry.version === version,
                    ),
                );
            }
        }
        return isDeepStrictEqual(actual ?? {}, dependencies);
    } catch {
        return false;
    }
}

/**
 * Yarn Classic accepts registry-relative tarball references; retain its own serialization and validate each edit.
 * @param content the lock text Yarn wrote
 * @param registry the registry URL its resolved references start with
 * @returns the lock text with registry-relative references
 */
function relativeYarnLock(content: string, registry: string): string {
    const schema = z.record(z.string(), z.looseObject({ resolved: z.string().optional() }));
    const entries = schema.parse(parseSyml(content));
    const expected = structuredClone(entries);
    const base = new URL(registry.endsWith('/') ? registry : `${registry}/`);
    let edited = content;
    for (const entry of Object.values(expected)) {
        if (entry.resolved === undefined || !/^https?:\/\//u.test(entry.resolved)) continue;
        const url = new URL(entry.resolved);
        if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) continue;
        const relative = `${url.pathname.slice(base.pathname.length)}${url.search}${url.hash}`;
        entry.resolved = relative;
        edited = edited.replaceAll(JSON.stringify(entry.resolved), JSON.stringify(relative));
    }
    if (!isDeepStrictEqual(schema.parse(parseSyml(edited)), expected))
        throw new Error(
            'Cannot preserve Yarn lock entries while removing local registry routing. Existing files were preserved.',
        );
    return edited;
}

/**
 * Keep native npm package identities and integrity while resolving standard tarballs through local registry settings.
 * @param content the lock text Bun wrote
 * @param env the registry settings the resolution ran with
 * @returns the lock text without the registry's tarball URLs
 */
function portableBunLock(content: string, env: Record<string, string>): string {
    const schema = z.looseObject({ packages: z.record(z.string(), z.array(z.unknown())) });
    const parsed = schema.parse(parseJsonc(content));
    const expected = structuredClone(parsed);
    let edited = content;
    for (const [key, entry] of Object.entries(parsed.packages)) {
        const npm = z.tuple([z.string(), z.string(), z.record(z.string(), z.unknown()), z.string()]).safeParse(entry);
        if (!npm.success) continue;
        const [identity, resolved, , integrity] = npm.data;
        const separator = identity.lastIndexOf('@');
        const name = identity.slice(0, separator);
        const version = identity.slice(separator + 1);
        if (semver.valid(version) === null || !/^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/u.test(integrity)) continue;
        const scope = name.startsWith('@') ? name.split('/', 1)[0] : undefined;
        const registry =
            (scope === undefined ? undefined : env[`npm_config_${scope}:registry`]) ?? env['npm_config_registry'];
        if (registry === undefined) continue;
        const base = registry.endsWith('/') ? registry : `${registry}/`;
        const filename = name.slice(name.lastIndexOf('/') + 1);
        const standard = new URL(`${name}/-/${filename}-${version}.tgz`, base).href;
        if (resolved !== standard) continue;
        const copy = expected.packages[key];
        if (copy !== undefined) copy[1] = '';
        edited = applyEdits(edited, modify(edited, ['packages', key, 1], '', {}));
    }
    if (!isDeepStrictEqual(schema.parse(parseJsonc(edited)), expected))
        throw new Error(
            'Cannot preserve Bun lock entries while removing registry routing. Existing files were preserved.',
        );
    return edited;
}

function commands(manager: ReturnType<typeof parsePackageManager>, frozen: boolean): string[] {
    if (manager.name === 'npm')
        return [
            'npm',
            ...(frozen ? ['ci'] : ['install', '--package-lock-only']),
            '--no-audit',
            '--no-fund',
            '--omit-lockfile-registry-resolved',
        ];
    if (manager.name === 'bun')
        return ['bun', 'install', frozen ? '--frozen-lockfile' : '--lockfile-only', '--linker', 'hoisted'];
    if (manager.name === 'pnpm')
        return [
            'pnpm',
            'install',
            frozen ? '--frozen-lockfile' : '--lockfile-only',
            '--ignore-workspace',
            '--node-linker=hoisted',
        ];
    if (semver.major(manager.version) === 1) return ['yarn', 'install', ...(frozen ? ['--frozen-lockfile'] : [])];
    return ['yarn', 'install', ...(frozen ? ['--immutable'] : ['--mode=update-lockfile'])];
}

async function packageCommand(
    root: string,
    work: string,
    manager: ReturnType<typeof parsePackageManager>,
    frozen: boolean,
): Promise<void> {
    const env = await packageEnvironment(root);
    const credentials = Object.entries(env)
        .filter(([key]) => /(?:_authToken|_auth|_password|key)$/iu.test(key))
        .map(([, value]) => value)
        .filter((value) => value.length > 0);
    for (const [key, value] of Object.entries(env)) {
        if (!key.toLowerCase().endsWith('registry')) continue;
        const registry = new URL(value);
        if (registry.password !== '') credentials.push(registry.password, decodeURIComponent(registry.password));
    }
    const references: string[] = [];
    for (const [key, value] of Object.entries(env)) {
        if (!key.startsWith('npm_config_')) continue;
        const variable = `GSPOT_PACKAGE_SETTING_${references.length}`;
        env[variable] = value;
        references.push(`${key.slice('npm_config_'.length)}=\${${variable}}`);
    }
    // Native clients interpolate the values from the environment; this file contains no credentials.
    writeFileSync(join(work, '.npmrc'), `${references.join('\n')}\n`, { mode: 0o600 });
    if (manager.name === 'yarn' && semver.major(manager.version) >= 2) delete env['YARN_REGISTRY'];
    const version = await runToolCommand(undefined, [manager.name, '--version'], { cwd: work, env });
    if (version.code !== 0 || version.stdout.trim() !== manager.version)
        throw new MissingToolError(
            `The tool project requires ${manager.name}@${manager.version}. Install that package manager version first.`,
        );
    if (manager.name === 'yarn' && semver.major(manager.version) >= 2)
        credentials.push(...(await yarnSettings(root, work, env)));
    const result = await runToolCommand(undefined, commands(manager, frozen), { cwd: work, env });
    if (result.code !== 0) {
        const cause = acquisitionNote(`${result.stdout}\n${result.stderr}`);
        const message = `${manager.name} ${frozen ? 'immutable installation' : 'lock resolution'} failed (exit ${String(result.code)}). ${SETUP}. Registry credentials and package-manager output are not included.${cause === undefined ? '' : ` ${cause}`}`;
        if (frozen) throw new InstallationError(message);
        throw new Error(message);
    }
    const lockPath = join(work, LOCKS[manager.name]);
    const lock = readFileSync(lockPath, 'utf8');
    if (credentials.some((value) => lock.includes(value) || lock.includes(encodeURIComponent(value))))
        throw new Error(
            'The package manager included registry credentials in its lock. Existing files were preserved.',
        );
    if (!frozen && manager.name === 'bun') writeFileSync(lockPath, portableBunLock(lock, env));
    if (!frozen && manager.name === 'yarn' && semver.major(manager.version) === 1) {
        const registry = env['npm_config_registry'];
        if (registry === undefined)
            throw new Error('A Yarn 1 lockfile needs npm_config_registry to relocate its URLs.');
        writeFileSync(lockPath, relativeYarnLock(lock, registry));
    }
}

function writeProject(work: string, manifest: string, yarn: string | undefined): void {
    writeFileSync(join(work, 'package.json'), manifest);
    if (yarn !== undefined) writeFileSync(join(work, '.yarnrc.yml'), yarn);
}

/**
 * Resolve only a missing or mismatched tool lock, before apply publishes generated files.
 * @param root the repository root
 * @param files the generated files, among them the tool project
 * @param owner the lifecycle owner that records the lock
 */
export async function resolvePackageProject(
    root: string,
    files: GeneratedFile[],
    owner: LifecycleOwner,
): Promise<void> {
    const project = files.find((file) => file.path === PROJECT);
    if (project === undefined) return;
    const manifest = packageSchema.parse(JSON.parse(project.content));
    const manager = parsePackageManager(manifest.packageManager);
    const lock = LOCKS[manager.name];
    const path = `.gspot/${lock}`;
    const original = owner.read(path);
    let content = original?.bytes.toString('utf8');
    const unchanged = owner.read(PROJECT)?.bytes.equals(Buffer.from(project.content)) === true;
    if (!unchanged || content === undefined || !lockMatches(manager.name, content, manifest.devDependencies)) {
        const work = mkdtempSync(join(tmpdir(), 'gspot-lock-'));
        try {
            writeProject(work, project.content, files.find((file) => file.path === '.gspot/.yarnrc.yml')?.content);
            if (content !== undefined && lockMatches(manager.name, content, manifest.devDependencies))
                writeFileSync(join(work, lock), content);
            await packageCommand(root, work, manager, false);
            content = readFileSync(join(work, lock), 'utf8');
            if (!lockMatches(manager.name, content, manifest.devDependencies))
                throw new Error(`${manager.name} produced a mismatched tool lock. Existing files were preserved.`);
        } finally {
            rmSync(work, { recursive: true, force: true });
        }
    }
    files.push({
        path,
        content,
        readOnly: true,
        kind: 'lock',
        ...(original === undefined ? {} : { observed: original }),
    });
}

/**
 * Compare generated package requirements to the recorded native lock without resolving or writing.
 * @param root the repository root
 * @param generated the generated files, among them the tool project
 * @returns the lock path with what is wrong with it, or undefined when there is no tool project
 */
export function packageLockDrift(
    root: string,
    generated: GeneratedFile[],
): { path: string; kind?: 'missing' | 'changed' } | undefined {
    const project = generated.find((file) => file.path === PROJECT);
    if (project === undefined) return undefined;
    const manifest = packageSchema.parse(JSON.parse(project.content));
    const manager = parsePackageManager(manifest.packageManager);
    const path = `.gspot/${LOCKS[manager.name]}`;
    const files = openConfinedRoot(root);
    try {
        const recorded = files.read(path);
        if (recorded === undefined) return { path, kind: 'missing' };
        return lockMatches(manager.name, recorded.bytes.toString('utf8'), manifest.devDependencies)
            ? { path }
            : { path, kind: 'changed' };
    } finally {
        files.close();
    }
}

/**
 * Validate the recorded inputs and preview native immutable commands without creating ownership state.
 * @param root the repository root
 * @returns the commands an install runs, or none without a tool project
 */
export function packageInstallSteps(root: string): string[][] {
    const files = openConfinedRoot(root);
    try {
        const project = files.read(PROJECT);
        if (project === undefined) return [];
        const manifest = packageSchema.parse(JSON.parse(project.bytes.toString('utf8')));
        const manager = parsePackageManager(manifest.packageManager);
        const recorded = files.read(`.gspot/${LOCKS[manager.name]}`);
        if (
            recorded === undefined ||
            !lockMatches(manager.name, recorded.bytes.toString('utf8'), manifest.devDependencies)
        )
            throw new Error(SETUP);
        return [commands(manager, true)];
    } finally {
        files.close();
    }
}

/**
 * Install locked packages outside the repository, then publish each owned entry through native confinement.
 * @param root the repository root
 * @param tools the pinned tools whose native wrappers the installation prepares
 * @returns the line that says what was installed, or '' without a tool project
 */
export async function installPackageProject(root: string, tools: Iterable<ToolPin>): Promise<string> {
    return withLifecycleOwner(root, async (owner) => {
        const project = owner.read(PROJECT);
        if (project === undefined) return '';
        const manifest = packageSchema.parse(JSON.parse(project.bytes.toString('utf8')));
        const manager = parsePackageManager(manifest.packageManager);
        const lock = LOCKS[manager.name];
        const recorded = owner.read(`.gspot/${lock}`);
        if (
            recorded === undefined ||
            !lockMatches(manager.name, recorded.bytes.toString('utf8'), manifest.devDependencies)
        )
            throw new Error(SETUP);
        const yarn = owner.read('.gspot/.yarnrc.yml');
        const work = mkdtempSync(join(tmpdir(), 'gspot-install-'));
        try {
            writeProject(work, project.bytes.toString('utf8'), yarn?.bytes.toString('utf8'));
            writeFileSync(join(work, lock), recorded.bytes);
            await packageCommand(root, work, manager, true);
            await prepareNativeWrappers(work, manifest.devDependencies, tools);
            if (
                !readFileSync(join(work, 'package.json')).equals(project.bytes) ||
                !readFileSync(join(work, lock)).equals(recorded.bytes)
            )
                throw new Error(`${manager.name} changed locked inputs. No installed files were published. ${SETUP}`);
            if (
                !isDeepStrictEqual(owner.read(PROJECT), project) ||
                !isDeepStrictEqual(owner.read(`.gspot/${lock}`), recorded) ||
                !isDeepStrictEqual(owner.read('.gspot/.yarnrc.yml'), yarn)
            )
                throw new Error('Tool project inputs changed during installation. Retry the command.');
            publishInstalledFiles(owner, join(work, 'node_modules'), 'npm');
            return `installed locked npm tools under .gspot/node_modules with ${manager.name}@${manager.version}`;
        } finally {
            rmSync(work, { recursive: true, force: true });
        }
    });
}
