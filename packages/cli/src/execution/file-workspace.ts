import { tmpdir } from 'node:os';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';

import {
    constants,
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    realpathSync,
    rmSync,
    statSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';

const SCRATCH_EXTRAS = ['gspot.toml', 'package.json', 'tsconfig.json', 'pyproject.toml'];
const SCRATCH_DIRECTORIES = ['node_modules', '.venv'];

/**
 * Copy selected files and declared configurations without native discovery inputs.
 * @param root the repository root
 * @param paths the files to copy
 * @returns the workspace root, the original bytes by path, and its disposal
 */
export function createFileWorkspace(
    root: string,
    paths: string[],
): {
    root: string;
    originals: Map<string, Buffer>;
    [Symbol.dispose]: () => void;
} {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), 'gspot-files-')));
    const originals = new Map<string, Buffer>();
    try {
        const files = openConfinedRoot(root, 'native');
        try {
            for (const path of new Set(paths)) {
                const source = files.source(path);
                const bytes = readFileSync(source);
                originals.set(path, bytes);
                const target = join(directory, path);
                mkdirSync(dirname(target), { recursive: true });
                writeFileSync(target, bytes, { mode: statSync(source).mode & 0o777 });
            }
        } finally {
            files.close();
        }
        return {
            root: directory,
            originals,
            [Symbol.dispose]: () => {
                rmSync(directory, { recursive: true, force: true });
            },
        };
    } catch (error) {
        rmSync(directory, { recursive: true, force: true });
        throw error;
    }
}

/**
 * Copies selected source and configuration files for commands run outside the working tree.
 * @param root the repository root
 * @param paths the source paths relative to the repository root
 * @param scopePaths the scopes whose installed dependencies the command needs
 * @returns the temporary directory, which the caller must remove
 */
export function scratchCopy(root: string, paths: string[], scopePaths: string[]): string {
    const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'gspot-fix-')));
    const files = openConfinedRoot(root, 'native');
    try {
        const dependencies = [
            ...new Set(scopePaths.flatMap((scope) => SCRATCH_DIRECTORIES.map((name) => join(scope, name)))),
        ];
        const copied = new Set(
            [...paths, ...SCRATCH_EXTRAS].filter(
                (path) => !dependencies.some((dir) => path === dir || path.startsWith(`${dir}/`)),
            ),
        );
        for (const path of copied) {
            const source = join(root, path);
            if (statSync(source, { throwIfNoEntry: false }) === undefined) continue;
            const resolved = files.source(path);
            mkdirSync(dirname(join(scratch, path)), { recursive: true });
            cpSync(resolved, join(scratch, path), { dereference: true });
        }
        const copies = new Map<string, string>([[realpathSync(root), scratch]]);
        const pending: { source: string; target: string }[] = [];
        const fileLinks: { source: string; target: string }[] = [];
        for (const dir of dependencies) {
            if (statSync(join(root, dir), { throwIfNoEntry: false }) === undefined) continue;
            const source = realpathSync(join(root, dir));
            const target = join(scratch, dir);
            copies.set(source, target);
            cpSync(source, target, { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
            pending.push({ source, target });
        }
        const relocated = (source: string): string | undefined => {
            for (const [original, copied] of [...copies].toSorted(([left], [right]) => right.length - left.length)) {
                const local = relative(original, source);
                if (!isAbsolute(local) && local !== '..' && !local.startsWith(`..${sep}`)) return join(copied, local);
            }
            return undefined;
        };
        for (let directory = pending.pop(); directory !== undefined; directory = pending.pop()) {
            for (const entry of readdirSync(directory.source, { withFileTypes: true })) {
                const source = join(directory.source, entry.name);
                const target = join(directory.target, entry.name);
                if (entry.isDirectory()) pending.push({ source, target });
                else if (entry.isSymbolicLink()) {
                    const original = realpathSync(source);
                    if (statSync(original).isFile()) {
                        fileLinks.push({ source: original, target });
                        continue;
                    }
                    const destination = relocated(original);
                    unlinkSync(target);
                    if (destination !== undefined && statSync(destination, { throwIfNoEntry: false }) !== undefined) {
                        symlinkSync(relative(dirname(target), destination), target, 'dir');
                    } else {
                        copies.set(original, target);
                        cpSync(original, target, {
                            recursive: true,
                            verbatimSymlinks: true,
                            mode: constants.COPYFILE_FICLONE,
                        });
                        pending.push({ source: original, target });
                    }
                }
            }
        }
        for (const { source, target } of fileLinks) {
            const destination = relocated(source);
            unlinkSync(target);
            if (destination !== undefined && statSync(destination, { throwIfNoEntry: false }) !== undefined)
                symlinkSync(relative(dirname(target), destination), target, 'file');
            else cpSync(source, target);
        }
        return scratch;
    } catch (error) {
        rmSync(scratch, { recursive: true, force: true });
        throw error;
    } finally {
        files.close();
    }
}
