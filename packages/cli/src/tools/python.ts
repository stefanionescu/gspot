import { z } from 'zod';
import { parse, stringify } from 'smol-toml';
import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/platform/errors.ts';
import { join, resolve, isAbsolute } from 'node:path';
import { runToolCommand } from '#cli/tools/command.ts';
import type { GeneratedFile } from '#cli/types/kits.ts';
import type { ToolOwner } from '#cli/types/tools/tools.ts';
import type { Read } from '#cli/types/platform/platform.ts';
import { installedOutputs } from '#cli/tools/installed-files.ts';
import { GSPOT_FOLDER } from '#cli/config/repository/repository.ts';
import { normalizedPythonPackage } from '#cli/repository/packages.ts';
import { openRoot, scratchFolder } from '#cli/platform/filesystem.ts';
import { MODE_BITS, PRIVATE_FILE } from '#cli/config/platform/root.ts';
import { LOCK, SETUP, INDEX_SETTINGS, TOOL_PYTHON_PROJECT } from '#cli/config/tools/tools.ts';
import { chmodSync, lstatSync, unlinkSync, copyFileSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';

const projectSchema = z.strictObject({
    project: z.strictObject({
        name: z.literal('gspot-tools'),
        version: z.literal('0.0.0'),
        'requires-python': z.literal('>=3.11'),
        dependencies: z.array(z.string().regex(/^[a-z0-9._-]+==[a-z0-9.+!_-]+$/iu)),
    }),
    tool: z.strictObject({
        uv: z.strictObject({ package: z.literal(false), 'constraint-dependencies': z.array(z.string()).optional() }),
    }),
});
const lockSchema = z.object({
    version: z.literal(1),
    'requires-python': z.string(),
    manifest: z
        .object({ constraints: z.array(z.object({ name: z.string(), specifier: z.string() })).optional() })
        .optional(),
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

// Requirements as one text each, with the package name normalized, in order, so a project and its lock compare.
function requirementTexts(requirements: { name: string; specifier: string }[]): string[] {
    return requirements
        .map(({ name, specifier }) => `${normalizedPythonPackage(name)}${specifier}`)
        .toSorted((left, right) => left.localeCompare(right));
}

// Whether the lock was resolved under the constraints the project sets on transitive packages.
function constraintsMatch(constraints: string[], recorded: z.infer<typeof lockSchema>): boolean {
    const declared = constraints.map((constraint) => {
        const operator = constraint.search(/[<>!~=]/u);
        return { name: constraint.slice(0, operator), specifier: constraint.slice(operator) };
    });
    return isDeepStrictEqual(requirementTexts(declared), requirementTexts(recorded.manifest?.constraints ?? []));
}

function matches(project: string, lock: string): boolean {
    try {
        const parsed = projectSchema.parse(parse(project));
        const manifest = parsed.project;
        const recorded = lockSchema.parse(parse(lock));
        if (!constraintsMatch(parsed.tool.uv['constraint-dependencies'] ?? [], recorded)) return false;
        const root = recorded.package.find((entry) => entry.name === manifest.name && entry.source.virtual === '.');
        if (root === undefined || recorded['requires-python'] !== manifest['requires-python']) return false;
        const expected = manifest.dependencies
            .map((value) => {
                const [name, version] = value.split('==');
                if (name === undefined || version === undefined) throw new Error(`Invalid pinned dependency: ${value}`);
                return `${normalizedPythonPackage(name)}==${version}`;
            })
            .toSorted((left, right) => left.localeCompare(right));
        return isDeepStrictEqual(requirementTexts(root.metadata?.['requires-dist'] ?? []), expected);
    } catch {
        return false;
    }
}

/**
 * Preserve repository index settings while uv owns user configuration and environment precedence.
 * @param root the repository root
 * @param owner the lifecycle owner that reads the authored uv settings
 * @param work the directory the resolution runs in
 * @returns index credentials that must remain absent from generated lock files
 */
function writePythonSettings(root: string, owner: ToolOwner, work: string): string[] {
    const configuration = owner.read('uv.toml');
    const source = configuration ?? owner.read('pyproject.toml');
    const parsed = parse(source?.bytes.toString('utf8') ?? '');
    const table =
        configuration === undefined
            ? z
                  .object({ tool: z.object({ uv: z.record(z.string(), z.unknown()).default({}) }).default({ uv: {} }) })
                  .parse(parsed).tool.uv
            : parsed;
    const selected = Object.fromEntries(Object.entries(table).filter(([key]) => INDEX_SETTINGS.has(key)));
    if (selected['find-links'] !== undefined)
        selected['find-links'] = z
            .array(z.string())
            .parse(selected['find-links'])
            .map((value) => (/^[a-z][a-z0-9+.-]*:/iu.test(value) || isAbsolute(value) ? value : resolve(root, value)));
    if (selected['index'] !== undefined)
        selected['index'] = z
            .array(z.looseObject({ url: z.string() }))
            .parse(selected['index'])
            .map((index) => ({
                ...index,
                url:
                    /^[a-z][a-z0-9+.-]*:/iu.test(index.url) || isAbsolute(index.url)
                        ? index.url
                        : resolve(root, index.url),
            }));
    if (Object.keys(selected).length > 0)
        writeFileSync(join(work, 'uv.toml'), stringify(selected), { mode: PRIVATE_FILE });
    return Object.entries(selected).flatMap(([key, value]) => {
        const entries: unknown[] = Array.isArray(value) ? value : [value];
        const settingEntries =
            key === 'index'
                ? entries.map((entry) => z.object({ url: z.string() }).parse(entry).url)
                : entries.filter((entry) => typeof entry === 'string');
        return settingEntries.flatMap((value) => {
            if (!/^https?:\/\//u.test(value)) return [];
            const url = new URL(value);
            return url.password === '' ? [] : [url.password, decodeURIComponent(url.password)];
        });
    });
}

async function uv(root: string, owner: ToolOwner, work: string, args: string[], executable = 'uv'): Promise<void> {
    const credentials = writePythonSettings(root, owner, work);
    const result = await runToolCommand(
        undefined,
        [executable, ...args, '--project', work, '--directory', work, '--no-python-downloads'],
        {
            cwd: work,
            env: { UV_PROJECT_ENVIRONMENT: join(work, '.venv'), UV_VENV_RELOCATABLE: 'true', UV_LINK_MODE: 'copy' },
        },
    );
    if (result.missing) throw new GspotError('missing-tool', `Install uv, then run: gspot install. ${SETUP}`);
    if (result.code !== 0) {
        const text = `uv ${args[0] ?? ''} failed (exit ${String(result.code)}). Check uv, Python, and index settings. ${SETUP}`;
        if (args[0] === 'sync') throw new GspotError('installation', text);
        throw new Error(text);
    }
    const lock = readFileSync(join(work, 'uv.lock'), 'utf8');
    if (credentials.some((value) => lock.includes(value) || lock.includes(encodeURIComponent(value))))
        throw new Error('The uv lock includes repository index credentials. Existing files were preserved.');
}

// Detach the host interpreter link and verify the copied environment before writing.
async function relocateInterpreter(work: string): Promise<void> {
    // uv links the host interpreter. Copy its executable so the written environment has no external link.
    const interpreter = join(work, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const source = realpathSync(interpreter);
    const mode = lstatSync(source).mode & MODE_BITS;
    if (lstatSync(interpreter).isSymbolicLink()) {
        unlinkSync(interpreter);
        copyFileSync(source, interpreter);
        chmodSync(interpreter, mode);
    }
    const read = await runToolCommand(
        undefined,
        [interpreter, '-c', 'import sys, ssl; assert sys.prefix != sys.base_prefix'],
        { cwd: work },
    );
    if (read.code !== 0)
        throw new Error(
            'The Python interpreter cannot run from a copied environment. No installed files were written.',
        );
}

// Lock, sync, and relocate the environment in a scratch folder, then install it once its inputs are unchanged.
async function installInWork(
    root: string,
    owner: ToolOwner,
    work: string,
    inputs: { project: Read; lock: Read },
    executable: string,
): Promise<void> {
    const { project, lock } = inputs;
    writeFileSync(join(work, 'pyproject.toml'), project.bytes);
    writeFileSync(join(work, 'uv.lock'), lock.bytes);
    await uv(root, owner, work, ['venv', '--relocatable', '.venv'], executable);
    await uv(root, owner, work, ['sync', '--locked', '--no-install-project'], executable);
    if (
        !readFileSync(join(work, 'pyproject.toml')).equals(project.bytes) ||
        !readFileSync(join(work, 'uv.lock')).equals(lock.bytes)
    )
        throw new Error(`The uv run changed locked inputs. ${SETUP}`);
    await relocateInterpreter(work);
    if (!isDeepStrictEqual(owner.read(TOOL_PYTHON_PROJECT), project) || !isDeepStrictEqual(owner.read(LOCK), lock))
        throw new Error('Python tool inputs changed during installation. Retry the command.');
    owner.installTree('python', installedOutputs(join(work, '.venv'), 'python'));
}

/**
 * Resolve Python tool requirements outside the repository before writing generated files.
 * @param root the repository root
 * @param files the generated files, among them the Python project
 * @param owner the lifecycle owner that records the lock
 */
export async function preparePythonProject(root: string, files: GeneratedFile[], owner: ToolOwner): Promise<void> {
    const project = files.find((file) => file.path === TOOL_PYTHON_PROJECT);
    if (project === undefined) return;
    projectSchema.parse(parse(project.content));
    const original = owner.read(LOCK);
    let content = original?.bytes.toString('utf8');
    if (content === undefined || !matches(project.content, content)) {
        using workFolder = scratchFolder('gspot-python-lock-');
        const work = workFolder.path;
        writeFileSync(join(work, 'pyproject.toml'), project.content);
        await uv(root, owner, work, ['lock']);
        content = readFileSync(join(work, 'uv.lock'), 'utf8');
        if (!matches(project.content, content))
            throw new Error('The uv lock does not match the tool project. Existing files were preserved.');
    }
    files.push({
        path: LOCK,
        content,
        readOnly: true,
        kind: 'lock',
        ...(original === undefined ? {} : { read: original }),
    });
}

/**
 * Read Python lock drift without resolving dependencies or creating ownership state.
 * @param root the repository root
 * @param generated the generated files, among them the Python project
 * @returns the lock path with what is wrong with it, or undefined when there is no Python project
 */
export function pythonLockDrift(
    root: string,
    generated: GeneratedFile[],
): { path: string; kind?: 'missing' | 'changed' } | undefined {
    const project = generated.find((file) => file.path === TOOL_PYTHON_PROJECT);
    if (project === undefined) return undefined;
    using files = openRoot(root);
    const lock = files.read(LOCK);
    if (lock === undefined) return { path: LOCK, kind: 'missing' };
    return matches(project.content, lock.bytes.toString('utf8')) ? { path: LOCK } : { path: LOCK, kind: 'changed' };
}

/**
 * Validate immutable Python inputs for a read-only installation preview.
 * @param root the repository root
 * @returns the commands an install runs, or none without a Python project
 */
export function pythonInstallSteps(root: string): string[][] {
    using files = openRoot(root);
    const project = files.read(TOOL_PYTHON_PROJECT);
    if (project === undefined) return [];
    projectSchema.parse(parse(project.bytes.toString('utf8')));
    const lock = files.read(LOCK);
    if (lock === undefined || !matches(project.bytes.toString('utf8'), lock.bytes.toString('utf8')))
        throw new Error(SETUP);
    return [['uv', 'sync', '--locked', '--project', GSPOT_FOLDER]];
}

/**
 * Install Python tools immutably and write the relocatable environment through lifecycle ownership.
 * @param root the repository root
 * @param owner the lifecycle owner that records the writes
 * @param executable the uv executable to run
 * @returns the line that says what was installed, or '' without a Python project
 */
export async function installPythonProject(root: string, owner: ToolOwner, executable = 'uv'): Promise<string> {
    const project = owner.read(TOOL_PYTHON_PROJECT);
    if (project === undefined) return '';
    projectSchema.parse(parse(project.bytes.toString('utf8')));
    const lock = owner.read(LOCK);
    if (lock === undefined || !matches(project.bytes.toString('utf8'), lock.bytes.toString('utf8')))
        throw new Error(SETUP);
    using workFolder = scratchFolder('gspot-python-install-');
    const work = workFolder.path;
    await installInWork(root, owner, work, { project, lock }, executable);
    return 'installed locked Python tools under .gspot/.venv';
}
