// A copied virtual environment names working-tree interpreters in its launchers; these read its facts and move them.
import { EXECUTE_BITS } from '#cli/constants/platform.ts';
import { readdir, realpath, stat } from 'node:fs/promises';
import { basename, isAbsolute, join, posix } from 'node:path';
import { SelectionError } from '#cli/configurations/select.ts';
import type { ConfinedRoot, FileSnapshot } from '#cli/types/platform.ts';
import { relocateWindowsLauncher } from '#cli/repository/windows-launcher.ts';
import type { PythonLauncher, RelocationContext } from '#cli/types/repository/revisions.ts';

// The local file header signature that opens a ZIP archive.
const ZIP_SIGNATURE = Buffer.from('PK\u0003\u0004');

// The value of one key in a pyvenv.cfg text, or undefined when the key is absent or empty.
function pyvenvSetting(config: string, key: string): string | undefined {
    for (const line of config.split('\n')) {
        if (!line.startsWith(key)) continue;
        const rest = line.slice(key.length).trimStart();
        if (!rest.startsWith('=')) continue;
        const value = rest.slice(1).trim();
        return value === '' ? undefined : value;
    }
    return undefined;
}

// The host and version an isolated environment declares, or undefined when the configuration is incomplete.
function environmentFacts(config: string): { home: string; version: string } | undefined {
    if (/^include-system-site-packages\s*=\s*true\s*$/mu.test(config))
        throw new SelectionError([
            'The installed Python environment exposes system packages. Prepare an isolated virtual environment for this revision.',
        ]);
    const home = pyvenvSetting(config, 'home');
    const version = /^(?:version_info|version)\s*=\s*(3\.\d+)/mu.exec(config)?.[1];
    if (home === undefined || !isAbsolute(home) || version === undefined) return undefined;
    return /^include-system-site-packages\s*=\s*false\s*$/mu.test(config) ? { home, version } : undefined;
}

// The host interpreter a launcher name resolves to, when it is an executable file.
async function hostInterpreter(home: string, name: string, windows: boolean): Promise<string | undefined> {
    try {
        const path = await realpath(join(home, name));
        const entry = await stat(path);
        return entry.isFile() && (windows || (entry.mode & EXECUTE_BITS) !== 0) ? path : undefined;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

// The kind of launcher a file is: a Windows executable, a script with a shebang, or neither.
async function launcherKind(
    selected: ConfinedRoot,
    path: string,
    name: string,
): Promise<'windows' | 'shell' | undefined> {
    const signature = await Bun.file(selected.source(path)).slice(0, 2).text();
    if (signature === '#!') return 'shell';
    return signature === 'MZ' && name.endsWith('.exe') ? 'windows' : undefined;
}

// The shebang header of a zip-appended Windows script that names this interpreter under a source root.
function zipHeader(bytes: Buffer, sourcePaths: string[], directory: string, name: string): Buffer | undefined {
    const headers = sourcePaths.flatMap((source) => {
        const interpreter = join(source, basename(directory), name);
        return [interpreter, `"${interpreter}"`].map((value) => Buffer.from(`#!${value}\n`));
    });
    return headers.find((candidate) => {
        const offset = bytes.indexOf(candidate);
        const after = offset + candidate.length;
        return offset !== -1 && bytes.subarray(after, after + ZIP_SIGNATURE.length).equals(ZIP_SIGNATURE);
    });
}

// Points a uv launcher or a zip-appended script at the snapshot interpreter it was built for.
function relocateWindowsScript(
    context: RelocationContext,
    launcher: PythonLauncher,
    path: string,
    current: FileSnapshot,
    sourcePaths: string[],
): void {
    const { selected, snapshot } = context;
    const interpreters = new Map(
        sourcePaths.flatMap((source) =>
            launcher.names.map(
                (name) =>
                    [
                        join(source, basename(launcher.directory), name),
                        join(snapshot, launcher.directory, name),
                    ] as const,
            ),
        ),
    );
    const relocatedUv = relocateWindowsLauncher(current.bytes, interpreters, launcher.hosts);
    if (relocatedUv !== undefined) {
        selected.write(path, { bytes: relocatedUv, mode: current.mode }, current);
        return;
    }
    for (const name of launcher.names) {
        const header = zipHeader(current.bytes, sourcePaths, launcher.directory, name);
        if (header === undefined) continue;
        const offset = current.bytes.indexOf(header);
        const relocated = Buffer.concat([
            current.bytes.subarray(0, offset),
            Buffer.from(`#!"${join(snapshot, launcher.directory, name)}"\n`),
            current.bytes.subarray(offset + header.length),
        ]);
        selected.write(path, { bytes: relocated, mode: current.mode }, current);
        return;
    }
}

// The headers pip writes for one interpreter: a plain shebang, and the sh trampoline in its three quotings.
function shellHeaders(interpreter: string): string[] {
    const quotings = [interpreter, `'${interpreter.replaceAll("'", "'\"'\"'")}'`, `"${interpreter}"`];
    return [`#!${interpreter}\n`, ...quotings.map((quoted) => `#!/bin/sh\n'''exec' ${quoted} "$0" "$@"\n' '''\n`)];
}

// Points a shebang script at the snapshot interpreter through the sh trampoline.
function relocateShellScript(
    context: RelocationContext,
    launcher: PythonLauncher,
    path: string,
    current: FileSnapshot,
    sourcePaths: string[],
): void {
    const text = current.bytes.toString('utf8');
    for (const name of launcher.names) {
        const headers = sourcePaths.flatMap((source) => shellHeaders(join(source, 'bin', name)));
        const header = headers.find((candidate) => text.startsWith(candidate));
        if (header === undefined) continue;
        const interpreter = join(context.snapshot, launcher.directory, name).replaceAll("'", "'\"'\"'");
        const relocated = `#!/bin/sh\n'''exec' '${interpreter}' "$0" "$@"\n' '''\n${text.slice(header.length)}`;
        context.selected.write(path, { bytes: Buffer.from(relocated), mode: current.mode }, current);
        return;
    }
}

// Points one launcher file at the snapshot interpreter, when it is a Windows executable or a shebang script.
async function relocateLauncherFile(
    context: RelocationContext,
    launcher: PythonLauncher,
    name: string,
    sourcePaths: string[],
): Promise<void> {
    const path = posix.join(launcher.directory, name);
    const kind = await launcherKind(context.selected, path, name);
    if (kind === undefined) return;
    const current = context.selected.read(path);
    if (current === undefined) return;
    if (kind === 'windows') relocateWindowsScript(context, launcher, path, current, sourcePaths);
    else relocateShellScript(context, launcher, path, current, sourcePaths);
}

/**
 * The launcher facts of a copied virtual environment, or undefined when its configuration names no usable host.
 * The interpreter links the copied environment may keep are added to interpreterLinks.
 * @param context the snapshot, its roots, and cancellation
 * @param folder the project folder that owns the .venv
 * @param source the working-tree .venv the copy came from
 * @param interpreterLinks the links each copied interpreter may point at, extended here
 * @returns the launcher facts
 */
export async function pythonLauncher(
    context: RelocationContext,
    folder: string,
    source: string,
    interpreterLinks: Map<string, ReadonlySet<string>>,
): Promise<PythonLauncher | undefined> {
    const { selected, snapshot } = context;
    const environment = posix.join(folder, '.venv');
    const config = selected.read(posix.join(environment, 'pyvenv.cfg'))?.bytes.toString('utf8') ?? '';
    const facts = environmentFacts(config);
    if (facts === undefined) return undefined;
    const windows = selected.stat(posix.join(environment, 'Scripts')) !== undefined;
    const names: [string, ...string[]] = windows
        ? ['python.exe', 'pythonw.exe']
        : ['python', 'python3', `python${facts.version}`];
    // A virtual environment shares its declared host interpreter, not host packages.
    const candidates = await Promise.all(names.map((name) => hostInterpreter(facts.home, name, windows)));
    const hosts = new Set(candidates.filter((path) => path !== undefined));
    const directory = posix.join(environment, windows ? 'Scripts' : 'bin');
    for (const name of names) interpreterLinks.set(join(snapshot, directory, name), hosts);
    const sitePackages = windows
        ? posix.join(environment, 'Lib', 'site-packages')
        : posix.join(environment, 'lib', `python${facts.version}`, 'site-packages');
    return { directory, source, names, hosts, sitePackages };
}

/**
 * Rewrites every launcher script in the copied environment to run the snapshot interpreter.
 * @param context the snapshot, its roots, and cancellation
 * @param launcher the copied environment
 */
export async function relocateLaunchers(context: RelocationContext, launcher: PythonLauncher): Promise<void> {
    const { selected, snapshot, cancelSignal } = context;
    if (selected.stat(launcher.directory) === undefined) return;
    const sourcePaths = [...new Set([launcher.source, await realpath(launcher.source)])];
    for (const entry of await readdir(join(snapshot, launcher.directory), { withFileTypes: true })) {
        cancelSignal?.throwIfAborted();
        if (entry.isFile()) await relocateLauncherFile(context, launcher, entry.name, sourcePaths);
    }
}
