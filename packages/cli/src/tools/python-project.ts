import { z } from 'zod';
import { tmpdir } from 'node:os';
import { parse, stringify } from 'smol-toml';
import { isDeepStrictEqual } from 'node:util';
import { isAbsolute, join, resolve } from 'node:path';
import { runToolCommand } from '#cli/tools/command.ts';
import type { GeneratedFile } from '#cli/lifecycle/apply.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import type { LifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { publishInstalledFiles } from '#cli/tools/installed-files.ts';
import { normalizedPythonPackage } from '#cli/repository/manifests.ts';
import { InstallationError, MissingToolError } from '#cli/tools/errors.ts';

import {
    chmodSync,
    copyFileSync,
    lstatSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';

const PROJECT = '.gspot/pyproject.toml';
const LOCK = '.gspot/uv.lock';
const SETUP = 'Run: gspot apply, then gspot install';
const projectSchema = z.strictObject({
    project: z.strictObject({
        name: z.literal('gspot-tools'),
        version: z.literal('0.0.0'),
        'requires-python': z.literal('>=3.11'),
        dependencies: z.array(z.string().regex(/^[a-z0-9._-]+==[a-z0-9.+!_-]+$/iu)),
    }),
    tool: z.strictObject({ uv: z.strictObject({ package: z.literal(false) }) }),
});
const lockSchema = z.object({
    version: z.literal(1),
    'requires-python': z.string(),
    package: z.array(
        z.object({
            name: z.string(),
            version: z.string(),
            source: z.looseObject({ virtual: z.string().optional() }),
            metadata: z
                .object({ 'requires-dist': z.array(z.object({ name: z.string(), specifier: z.string() })).optional() })
                .optional(),
        }),
    ),
});

function matches(project: string, lock: string): boolean {
    try {
        const manifest = projectSchema.parse(parse(project)).project;
        const recorded = lockSchema.parse(parse(lock));
        const root = recorded.package.find((entry) => entry.name === manifest.name && entry.source.virtual === '.');
        if (root === undefined || recorded['requires-python'] !== manifest['requires-python']) return false;
        const expected = manifest.dependencies
            .map((value) => {
                const [name, version] = value.split('==');
                return `${normalizedPythonPackage(name!)}==${version}`;
            })
            .toSorted((left, right) => left.localeCompare(right));
        const actual = (root.metadata?.['requires-dist'] ?? [])
            .map((entry) => `${normalizedPythonPackage(entry.name)}${entry.specifier}`)
            .toSorted((left, right) => left.localeCompare(right));
        return isDeepStrictEqual(actual, expected);
    } catch {
        return false;
    }
}

const INDEX_SETTINGS = new Set([
    'index',
    'index-url',
    'extra-index-url',
    'find-links',
    'index-strategy',
    'keyring-provider',
    'native-tls',
    'system-certs',
    'allow-insecure-host',
    'offline',
]);

/**
 * Preserve repository index settings while uv owns user configuration and environment precedence.
 * @param root the repository root
 * @param owner the lifecycle owner that reads the authored uv settings
 * @param work the directory the resolution runs in
 * @returns the uv arguments that carry the repository's index settings
 */
function pythonSettings(root: string, owner: LifecycleOwner, work: string): string[] {
    const configuration = owner.read('uv.toml');
    const project = configuration === undefined ? owner.read('pyproject.toml') : undefined;
    const parsed = parse((configuration ?? project)?.bytes.toString('utf8') ?? '');
    const table =
        configuration === undefined
            ? (z
                  .object({ tool: z.object({ uv: z.record(z.string(), z.unknown()).optional() }).optional() })
                  .parse(parsed).tool?.uv ?? {})
            : parsed;
    const location = (value: string): string =>
        /^[a-z][a-z0-9+.-]*:/iu.test(value) || isAbsolute(value) ? value : resolve(root, value);
    const selected = Object.fromEntries(Object.entries(table).filter(([key]) => INDEX_SETTINGS.has(key)));
    if (selected['find-links'] !== undefined)
        selected['find-links'] = z.array(z.string()).parse(selected['find-links']).map(location);
    if (selected['index'] !== undefined)
        selected['index'] = z
            .array(z.looseObject({ url: z.string() }))
            .parse(selected['index'])
            .map((index) => ({ ...index, url: location(index.url) }));
    if (Object.keys(selected).length > 0) writeFileSync(join(work, 'uv.toml'), stringify(selected), { mode: 0o600 });
    return Object.entries(selected).flatMap(([key, value]) => {
        const values =
            key === 'index' && Array.isArray(value)
                ? value.map((entry) => z.object({ url: z.string() }).parse(entry).url)
                : typeof value === 'string'
                  ? [value]
                  : Array.isArray(value)
                    ? value.filter((entry) => typeof entry === 'string')
                    : [];
        return values.flatMap((value) => {
            if (!/^https?:\/\//u.test(value)) return [];
            const url = new URL(value);
            return url.password === '' ? [] : [url.password, decodeURIComponent(url.password)];
        });
    });
}

async function uv(root: string, owner: LifecycleOwner, work: string, args: string[], executable = 'uv'): Promise<void> {
    const credentials = pythonSettings(root, owner, work);
    const result = await runToolCommand(
        undefined,
        [executable, ...args, '--project', work, '--directory', work, '--no-python-downloads'],
        {
            cwd: work,
            env: { UV_PROJECT_ENVIRONMENT: join(work, '.venv'), UV_VENV_RELOCATABLE: 'true', UV_LINK_MODE: 'copy' },
        },
    );
    if (result.missing) throw new MissingToolError(`Install uv, then run: gspot install. ${SETUP}`);
    if (result.code !== 0) {
        const message = `uv ${args[0]} failed (exit ${String(result.code)}). Check uv, Python, and index settings. ${SETUP}`;
        if (args[0] === 'sync') throw new InstallationError(message);
        throw new Error(message);
    }
    const lock = readFileSync(join(work, 'uv.lock'), 'utf8');
    if (credentials.some((value) => lock.includes(value) || lock.includes(encodeURIComponent(value))))
        throw new Error('The uv lock includes repository index credentials. Existing files were preserved.');
}

/**
 * Resolve Python tool requirements outside the repository before publishing generated files.
 * @param root the repository root
 * @param files the generated files, among them the Python project
 * @param owner the lifecycle owner that records the lock
 */
export async function resolvePythonProject(root: string, files: GeneratedFile[], owner: LifecycleOwner): Promise<void> {
    const project = files.find((file) => file.path === PROJECT);
    if (project === undefined) return;
    projectSchema.parse(parse(project.content));
    const original = owner.read(LOCK);
    let content = original?.bytes.toString('utf8');
    if (content === undefined || !matches(project.content, content)) {
        const work = mkdtempSync(join(tmpdir(), 'gspot-python-lock-'));
        try {
            writeFileSync(join(work, 'pyproject.toml'), project.content);
            await uv(root, owner, work, ['lock']);
            content = readFileSync(join(work, 'uv.lock'), 'utf8');
            if (!matches(project.content, content))
                throw new Error('The uv lock does not match the tool project. Existing files were preserved.');
        } finally {
            rmSync(work, { recursive: true, force: true });
        }
    }
    files.push({
        path: LOCK,
        content,
        readOnly: true,
        kind: 'lock',
        ...(original === undefined ? {} : { observed: original }),
    });
}

/**
 * Observe Python lock drift without resolving dependencies or creating ownership state.
 * @param root the repository root
 * @param generated the generated files, among them the Python project
 * @returns the lock path with what is wrong with it, or undefined when there is no Python project
 */
export function pythonLockDrift(
    root: string,
    generated: GeneratedFile[],
): { path: string; kind?: 'missing' | 'changed' } | undefined {
    const project = generated.find((file) => file.path === PROJECT);
    if (project === undefined) return undefined;
    const files = openConfinedRoot(root);
    try {
        const lock = files.read(LOCK);
        if (lock === undefined) return { path: LOCK, kind: 'missing' };
        return matches(project.content, lock.bytes.toString('utf8')) ? { path: LOCK } : { path: LOCK, kind: 'changed' };
    } finally {
        files.close();
    }
}

/**
 * Validate immutable Python inputs for a read-only installation preview.
 * @param root the repository root
 * @returns the commands an install runs, or none without a Python project
 */
export function pythonInstallSteps(root: string): string[][] {
    const files = openConfinedRoot(root);
    try {
        const project = files.read(PROJECT);
        if (project === undefined) return [];
        projectSchema.parse(parse(project.bytes.toString('utf8')));
        const lock = files.read(LOCK);
        if (lock === undefined || !matches(project.bytes.toString('utf8'), lock.bytes.toString('utf8')))
            throw new Error(SETUP);
        return [['uv', 'sync', '--locked', '--project', '.gspot']];
    } finally {
        files.close();
    }
}

/**
 * Install Python tools immutably and publish the relocatable environment through lifecycle ownership.
 * @param root the repository root
 * @param executable the uv executable to run
 * @returns the line that says what was installed, or '' without a Python project
 */
export async function installPythonProject(root: string, executable = 'uv'): Promise<string> {
    return withLifecycleOwner(root, async (owner) => {
        const project = owner.read(PROJECT);
        if (project === undefined) return '';
        projectSchema.parse(parse(project.bytes.toString('utf8')));
        const lock = owner.read(LOCK);
        if (lock === undefined || !matches(project.bytes.toString('utf8'), lock.bytes.toString('utf8')))
            throw new Error(SETUP);
        const work = mkdtempSync(join(tmpdir(), 'gspot-python-install-'));
        try {
            writeFileSync(join(work, 'pyproject.toml'), project.bytes);
            writeFileSync(join(work, 'uv.lock'), lock.bytes);
            await uv(root, owner, work, ['venv', '--relocatable', '.venv'], executable);
            await uv(root, owner, work, ['sync', '--locked', '--no-install-project'], executable);
            if (
                !readFileSync(join(work, 'pyproject.toml')).equals(project.bytes) ||
                !readFileSync(join(work, 'uv.lock')).equals(lock.bytes)
            )
                throw new Error(`The uv run changed locked inputs. ${SETUP}`);
            // uv links the host interpreter. Copy its executable so the published environment has no external link.
            const interpreter = join(work, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
            const source = realpathSync(interpreter);
            const mode = lstatSync(source).mode & 0o7777;
            if (lstatSync(interpreter).isSymbolicLink()) {
                unlinkSync(interpreter);
                copyFileSync(source, interpreter);
                chmodSync(interpreter, mode);
            }
            const observed = await runToolCommand(
                undefined,
                [interpreter, '-c', 'import sys, ssl; assert sys.prefix != sys.base_prefix'],
                { cwd: work },
            );
            if (observed.code !== 0)
                throw new Error(
                    'The Python interpreter cannot run from a copied environment. No installed files were published.',
                );
            if (!isDeepStrictEqual(owner.read(PROJECT), project) || !isDeepStrictEqual(owner.read(LOCK), lock))
                throw new Error('Python tool inputs changed during installation. Retry the command.');
            publishInstalledFiles(owner, join(work, '.venv'), 'python');
            return 'installed locked Python tools under .gspot/.venv';
        } finally {
            rmSync(work, { recursive: true, force: true });
        }
    });
}
