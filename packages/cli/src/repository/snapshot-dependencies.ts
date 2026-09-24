import { z } from 'zod';
import pLimit from 'p-limit';
import { createHash } from 'node:crypto';
import { run } from '#cli/platform/spawn.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { constants, readFileSync, statSync } from 'node:fs';
import { SelectionError } from '#cli/configurations/select.ts';
import { chmod, cp, mkdir, readdir, realpath, stat } from 'node:fs/promises';
import { openConfinedRoot } from '#cli/filesystem/confined.ts';
import { isValePackageFile } from '#cli/repository/file-classification.ts';
import { relocateWindowsLauncher } from '#cli/repository/windows-launcher.ts';
import { basename, dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';

const COPY_CONCURRENCY = 8;
const LOCKS = ['package-lock.json', 'bun.lock', 'pnpm-lock.yaml', 'yarn.lock', 'uv.lock', 'Package.resolved'];
const MANIFESTS = new Set(['package.json', 'pyproject.toml', 'Package.swift', ...LOCKS]);

// Parse installed loader metadata without importing it or processing site packages.
const PYTHON_EDITABLE_PATHS = `import ast, json, sys
source = sys.stdin.read()
lines = source.encode("utf-8").splitlines(keepends=True)
paths = []
def add_path(entry):
    if not isinstance(entry, ast.Constant) or not isinstance(entry.value, str):
        raise ValueError("Editable paths must be literal strings")
    paths.append({"start": sum(map(len, lines[:entry.lineno - 1])) + entry.col_offset,
                  "end": sum(map(len, lines[:entry.end_lineno - 1])) + entry.end_col_offset,
                  "path": entry.value})
for statement in ast.parse(source).body:
    if isinstance(statement, ast.Expr) and isinstance(statement.value, ast.Call):
        call = statement.value
        if isinstance(call.func, ast.Attribute) and isinstance(call.func.value, ast.Name) and call.func.value.id == "F" and call.func.attr == "map_module":
            if len(call.args) != 2 or call.keywords:
                raise ValueError("Editable module mappings must have two literal arguments")
            add_path(call.args[1])
        continue
    if isinstance(statement, ast.AnnAssign):
        targets = [statement.target]
    elif isinstance(statement, ast.Assign):
        targets = statement.targets
    else:
        continue
    if not any(isinstance(target, ast.Name) and target.id in ("MAPPING", "NAMESPACES") for target in targets):
        continue
    value = statement.value
    if not isinstance(value, ast.Dict):
        raise ValueError("Editable path metadata must be a literal dictionary")
    ast.literal_eval(value)
    for item in value.values:
        entries = item.elts if isinstance(item, (ast.List, ast.Tuple)) else [item]
        for entry in entries:
            add_path(entry)
print(json.dumps(paths))
`;
const PYTHON_PATH_SPANS = z.array(
    z.object({ start: z.number().int().nonnegative(), end: z.number().int().nonnegative(), path: z.string() }),
);

/**
 *
 * @param root
 * @param snapshot
 * @param paths
 */
export function copyProsePackages(root: string, snapshot: string, paths: string[]): void {
    for (const config of paths.filter(
        (path) => path === '.gspot/config/vale.ini' || path.endsWith('/.gspot/config/vale.ini'),
    )) {
        const folder = dirname(dirname(dirname(config)));
        const installed = openConfinedRoot(join(root, folder));
        const destination = openConfinedRoot(join(snapshot, folder));
        try {
            const packages = readOwnership(join(root, folder)).files.filter((entry) => isValePackageFile(entry.path));
            if (packages.length === 0) continue;
            const current = installed.read('.gspot/config/vale.ini');
            const selected = destination.read('.gspot/config/vale.ini');
            if (current === undefined || selected === undefined || !current.bytes.equals(selected.bytes))
                throw new SelectionError([
                    'Installed Vale packages do not match the revision configuration. Prepare this revision separately and run gspot apply.',
                ]);
            for (const entry of packages) {
                if (entry.installed === undefined || destination.read(entry.path) !== undefined) continue;
                const content = installed.read(entry.path);
                if (
                    content === undefined ||
                    createHash('sha256').update(content.bytes).digest('hex') !== entry.installed.hash ||
                    content.mode !== entry.installed.mode
                )
                    throw new SelectionError([
                        `Installed Vale package ${entry.path} is missing or edited. Repair it before checking this revision.`,
                    ]);
                destination.write(entry.path, content, undefined);
            }
        } finally {
            installed.close();
            destination.close();
        }
    }
}

async function validateCopiedLinks(
    root: string,
    directory: string,
    interpreterLinks: ReadonlyMap<string, ReadonlySet<string>>,
    cancelSignal?: AbortSignal,
): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        cancelSignal?.throwIfAborted();
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await validateCopiedLinks(root, path, interpreterLinks, cancelSignal);
        else if (entry.isSymbolicLink()) {
            let resolved: string;
            try {
                resolved = await realpath(path);
            } catch (error) {
                throw new SelectionError([
                    `Installed dependency link ${relative(root, path)} cannot be resolved: ${(error as Error).message}. Repair the dependency installation before checking this revision.`,
                ]);
            }
            const target = relative(root, resolved);
            if (
                (isAbsolute(target) || target === '..' || target.startsWith(`..${sep}`)) &&
                !interpreterLinks.get(path)?.has(resolved)
            )
                throw new SelectionError([
                    'Installed dependencies contain an external link. Prepare isolated dependencies for the selected revision.',
                ]);
        }
    }
}

/**
 *
 * @param root
 * @param snapshot
 * @param paths
 * @param cancelSignal
 */
export async function copyDependencies(
    root: string,
    snapshot: string,
    paths: string[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    const installed = openConfinedRoot(root, 'native');
    const selected = openConfinedRoot(snapshot, 'native');
    try {
        const inputs = paths.filter((path) => MANIFESTS.has(basename(path)));
        const projects = inputs.filter(
            (path) => basename(path) === 'package.json' || basename(path) === 'pyproject.toml',
        );
        const directories = projects.flatMap((path) => {
            const folder = dirname(path);
            const dependency = basename(path) === 'package.json' ? 'node_modules' : '.venv';
            return installed.stat(posix.join(folder, dependency)) === undefined ? [] : [{ folder, dependency }];
        });
        if (directories.length === 0) return;
        if (
            inputs.some(
                (path) =>
                    !(statSync(join(root, path), { throwIfNoEntry: false }) !== undefined) ||
                    !readFileSync(installed.source(path)).equals(readFileSync(selected.source(path))),
            )
        )
            throw new SelectionError([
                'Installed dependencies do not match the revision manifests and locks. Prepare this revision in a separate worktree and run gspot install.',
            ]);
        const interpreterLinks = new Map<string, ReadonlySet<string>>();
        const pythonLaunchers: {
            directory: string;
            source: string;
            names: [string, ...string[]];
            sitePackages: string;
            hosts: ReadonlySet<string>;
        }[] = [];
        for (const { folder, dependency } of directories) {
            const pending =
                basename(folder) === '.gspot' ? (readOwnership(join(root, dirname(folder))).installations ?? []) : [];
            assertDependencyReady(snapshot, folder, dependency, pending);
            const source = join(root, folder, dependency);
            const target = join(snapshot, folder, dependency);
            if ((statSync(target, { throwIfNoEntry: false }) !== undefined))
                throw new SelectionError([
                    'Installed dependencies are tracked in the selected revision. Untrack them before checking the index.',
                ]);
            const sourceMode = (await stat(source)).mode & 0o7777;
            await mkdir(target, { mode: 0o700 });
            const copy = pLimit(COPY_CONCURRENCY);
            // Each child has its own destination. Drain every copy before cleanup or link validation.
            const copied = await Promise.allSettled((await readdir(source)).map((name) => copy(async () => {
                cancelSignal?.throwIfAborted();
                await cp(join(source, name), join(target, name), {
                    recursive: true,
                    verbatimSymlinks: true,
                    mode: constants.COPYFILE_FICLONE,
                    filter: () => {
                        cancelSignal?.throwIfAborted();
                        return true;
                    },
                });
            })));
            for (const result of copied) if (result.status === 'rejected') throw result.reason;
            await chmod(target, sourceMode);
            if (dependency === '.venv') {
                const config =
                    selected.read(posix.join(folder, dependency, 'pyvenv.cfg'))?.bytes.toString('utf8') ?? '';
                if (/^include-system-site-packages\s*=\s*true\s*$/mu.test(config))
                    throw new SelectionError([
                        'The installed Python environment exposes system packages. Prepare an isolated virtual environment for this revision.',
                    ]);
                const home = /^home\s*=\s*(.+)$/mu.exec(config)?.[1]?.trim();
                const version = /^(?:version_info|version)\s*=\s*(3\.\d+)/mu.exec(config)?.[1];
                if (
                    home !== undefined &&
                    isAbsolute(home) &&
                    version !== undefined &&
                    /^include-system-site-packages\s*=\s*false\s*$/mu.test(config)
                ) {
                    const windows = selected.stat(posix.join(folder, dependency, 'Scripts')) !== undefined;
                    const names: [string, ...string[]] = windows
                        ? ['python.exe', 'pythonw.exe']
                        : ['python', 'python3', `python${version}`];
                    // A virtual environment shares its declared host interpreter, not host packages.
                    const candidates = await Promise.all(
                        names.map(async (name) => {
                            try {
                                const path = await realpath(join(home, name));
                                const entry = await stat(path);
                                return entry.isFile() && (windows || (entry.mode & 0o111) !== 0) ? path : undefined;
                            } catch (error) {
                                if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
                                throw error;
                            }
                        }),
                    );
                    const targets = new Set(candidates.filter((path) => path !== undefined));
                    const directory = posix.join(folder, dependency, windows ? 'Scripts' : 'bin');
                    for (const name of names) interpreterLinks.set(join(snapshot, directory, name), targets);
                    pythonLaunchers.push({
                        directory,
                        source,
                        names,
                        hosts: targets,
                        sitePackages: windows
                            ? posix.join(folder, dependency, 'Lib', 'site-packages')
                            : posix.join(folder, dependency, 'lib', `python${version}`, 'site-packages'),
                    });
                }
            }
        }
        for (const { folder, dependency } of directories)
            await validateCopiedLinks(snapshot, join(snapshot, folder, dependency), interpreterLinks, cancelSignal);
        const sourceRoots = [...new Set([root, await realpath(root)])];
        const relocatePath = (target: string): string => {
            const local = sourceRoots
                .map((sourceRoot) => relative(sourceRoot, target))
                .find((candidate) => !isAbsolute(candidate) && candidate !== '..' && !candidate.startsWith(`..${sep}`));
            if (local === undefined)
                throw new SelectionError([
                    'Installed Python path metadata references an external directory. Prepare isolated dependencies for the selected revision.',
                ]);
            if (local !== '' && selected.stat(local.split(sep).join('/')) === undefined)
                throw new SelectionError([
                    'Installed Python path metadata references source missing from the selected revision. Install dependencies for that revision separately.',
                ]);
            return join(snapshot, local);
        };
        for (const { directory, source, names, hosts } of pythonLaunchers) {
            if (selected.stat(directory) === undefined) continue;
            const sourcePaths = [...new Set([source, await realpath(source)])];
            for (const entry of await readdir(join(snapshot, directory), { withFileTypes: true })) {
                cancelSignal?.throwIfAborted();
                if (!entry.isFile()) continue;
                const path = posix.join(directory, entry.name);
                const signature = await Bun.file(selected.source(path)).slice(0, 2).text();
                if (signature !== '#!' && !(signature === 'MZ' && entry.name.endsWith('.exe'))) continue;
                const current = selected.read(path);
                if (current === undefined) continue;
                if (signature === 'MZ') {
                    const interpreters = new Map(
                        sourcePaths.flatMap((source) =>
                            names.map(
                                (name) =>
                                    [join(source, basename(directory), name), join(snapshot, directory, name)] as const,
                            ),
                        ),
                    );
                    const relocatedUv = relocateWindowsLauncher(current.bytes, interpreters, hosts);
                    if (relocatedUv !== undefined) {
                        selected.write(path, { bytes: relocatedUv, mode: current.mode }, current);
                        continue;
                    }
                    for (const name of names) {
                        const headers = sourcePaths.flatMap((source) => {
                            const interpreter = join(source, basename(directory), name);
                            return [interpreter, `"${interpreter}"`].map((value) => Buffer.from(`#!${value}\n`));
                        });
                        const header = headers.find((candidate) => {
                            const offset = current.bytes.indexOf(candidate);
                            return (
                                offset !== -1 &&
                                current.bytes
                                    .subarray(offset + candidate.length, offset + candidate.length + 4)
                                    .equals(Buffer.from('PK\u0003\u0004'))
                            );
                        });
                        if (header === undefined) continue;
                        const offset = current.bytes.indexOf(header);
                        const relocated = Buffer.concat([
                            current.bytes.subarray(0, offset),
                            Buffer.from(`#!"${join(snapshot, directory, name)}"\n`),
                            current.bytes.subarray(offset + header.length),
                        ]);
                        selected.write(path, { bytes: relocated, mode: current.mode }, current);
                        break;
                    }
                    continue;
                }
                const text = current.bytes.toString('utf8');
                for (const name of names) {
                    const headers = sourcePaths.flatMap((source) => {
                        const interpreter = join(source, 'bin', name);
                        return [
                            `#!${interpreter}\n`,
                            ...[interpreter, `'${interpreter.replaceAll("'", "'\"'\"'")}'`, `"${interpreter}"`].map(
                                (quoted) => `#!/bin/sh\n'''exec' ${quoted} "$0" "$@"\n' '''\n`,
                            ),
                        ];
                    });
                    const header = headers.find((header) => text.startsWith(header));
                    if (header === undefined) continue;
                    const interpreter = join(snapshot, directory, name);
                    const relocated = `#!/bin/sh\n'''exec' '${interpreter.replaceAll("'", "'\"'\"'")}' "$0" "$@"\n' '''\n${text.slice(header.length)}`;
                    selected.write(path, { bytes: Buffer.from(relocated), mode: current.mode }, current);
                    break;
                }
            }
        }
        for (const { directory, names, sitePackages } of pythonLaunchers) {
            if (selected.stat(sitePackages) !== undefined) {
                for (const entry of await readdir(join(snapshot, sitePackages), { withFileTypes: true })) {
                    cancelSignal?.throwIfAborted();
                    if (!entry.isFile()) continue;
                    const finder = /^(?:__editable__.*_finder|_editable_impl_.+)\.py$/u.test(entry.name);
                    if (!finder && !entry.name.endsWith('.pth')) continue;
                    const path = posix.join(sitePackages, entry.name);
                    const current = selected.read(path);
                    if (current === undefined) continue;
                    if (finder) {
                        const parsed = await run(
                            [join(snapshot, directory, names[0]), '-I', '-S', '-c', PYTHON_EDITABLE_PATHS],
                            {
                                cwd: snapshot,
                                stdin: current.bytes.toString('utf8'),
                                timeoutMs: 30_000,
                                ...(cancelSignal === undefined ? {} : { cancelSignal }),
                            },
                        );
                        if (parsed.code !== 0)
                            throw new SelectionError([
                                'Cannot parse installed editable Python loader metadata. Reinstall dependencies for the selected revision.',
                            ]);
                        const spans = PYTHON_PATH_SPANS.parse(JSON.parse(parsed.stdout));
                        let bytes = current.bytes;
                        for (const span of spans.toSorted((left, right) => right.start - left.start)) {
                            const relocated = relocatePath(resolve(root, sitePackages, span.path));
                            bytes = Buffer.concat([
                                bytes.subarray(0, span.start),
                                Buffer.from(JSON.stringify(relocated)),
                                bytes.subarray(span.end),
                            ]);
                        }
                        if (!bytes.equals(current.bytes)) selected.write(path, { bytes, mode: current.mode }, current);
                        // Unchecked hash caches can retain working-tree paths after source relocation.
                        const cache = posix.join(sitePackages, '__pycache__');
                        for (const name of selected.list(cache)) {
                            if (!name.startsWith(`${entry.name.slice(0, -3)}.`) || !name.endsWith('.pyc')) continue;
                            const cachedPath = posix.join(cache, name);
                            const cached = selected.read(cachedPath);
                            if (cached !== undefined) selected.remove(cachedPath, cached);
                        }
                        continue;
                    }
                    const relocated = current.bytes
                        .toString('utf8')
                        .split('\n')
                        .map((line) => {
                            if (line.startsWith('#') || line.trim() === '' || /^import[ \t]/u.test(line)) return line;
                            const target = resolve(root, sitePackages, line.trimEnd());
                            return relocatePath(target);
                        })
                        .join('\n');
                    if (relocated !== current.bytes.toString('utf8'))
                        selected.write(path, { bytes: Buffer.from(relocated), mode: current.mode }, current);
                }
            }
        }
    } finally {
        installed.close();
        selected.close();
    }
}

function assertDependencyReady(snapshot: string, folder: string, dependency: string, pending: string[]): void {
    if (basename(folder) === '.gspot' && pending.includes(dependency === 'node_modules' ? 'npm' : 'python'))
        throw new SelectionError([
            'Tool installation is incomplete. Run gspot install before checking staged content.',
        ]);
    if (
        !LOCKS.some((lock) => (statSync(join(snapshot, folder, lock), { throwIfNoEntry: false }) !== undefined)) &&
        !LOCKS.some((lock) => (statSync(join(snapshot, lock), { throwIfNoEntry: false }) !== undefined))
    )
        throw new SelectionError([
            'A revision dependency project has no lock to verify its installed environment. Prepare locked dependencies for this revision.',
        ]);
}
