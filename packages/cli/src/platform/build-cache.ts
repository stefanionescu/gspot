import { isDeepStrictEqual } from 'node:util';
import { readSource } from '#cli/repository/tracked.ts';
import { mkdirSync, readdirSync, statSync, lstatSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cacheHome } from '#cli/platform/environment.ts';
import { openConfinedRoot } from '#cli/filesystem/confined.ts';
import type { ConfinedRoot, FileSnapshot } from '#cli/types/filesystem.ts';


/** Prepare and lock one compiler directory without following existing output links. */
export function openBuildCache(folder: string): ConfinedRoot {
    const home = cacheHome();
    mkdirSync(home, { recursive: true });
    const boundary = openConfinedRoot(home);
    try {
        boundary.mkdir(relative(home, folder).replaceAll('\\', '/'), 0o700);
    } finally {
        boundary.close();
    }
    const files = openConfinedRoot(folder, 'native');
    try {
        files.lock('build.lock');
        const pending = [''];
        for (let directory = pending.pop(); directory !== undefined; directory = pending.pop()) {
            const path = directory === '' ? folder : files.source(directory);
            for (const entry of readdirSync(path, { withFileTypes: true })) {
                const local = directory === '' ? entry.name : `${directory}/${entry.name}`;
                if (entry.isSymbolicLink()) files.source(local);
                else if (entry.isDirectory()) pending.push(local);
            }
        }
        return files;
    } catch (error) {
        files.close();
        throw error;
    }
}

/** Restore selected sources in a stable compiler directory while retaining unchanged timestamps. */
export function prepareBuildSources(root: string, paths: string[], folder: string, files: ConfinedRoot): string {
    const source = openConfinedRoot(root, 'native');
    const desired = new Map<string, FileSnapshot>();
    try {
        for (const file of paths) {
            const path = `source/${file}`;
            const mode = statSync(source.source(file)).mode & 0o7777;
            desired.set(path, { bytes: readSource(root, file), mode });
        }
    } finally {
        source.close();
    }
    const wantedDirectories = new Set(
        [...desired.keys()].flatMap((path) => {
            const parts = path.split('/');
            return parts.slice(0, -1).map((_part, index) => parts.slice(0, index + 1).join('/'));
        }),
    );
    const directories = ['source'];
    const emptyDirectories: string[] = [];
    for (let directory = directories.pop(); directory !== undefined; directory = directories.pop()) {
        for (const name of files.list(directory)) {
            const path = `${directory}/${name}`;
            if (lstatSync(join(folder, path)).isSymbolicLink()) {
                const current = files.readEntry(path);
                if (current !== undefined) files.remove(path, current);
            } else if (files.stat(path)?.isDirectory()) {
                directories.push(path);
                if (!wantedDirectories.has(path)) emptyDirectories.push(path);
            } else if (!desired.has(path)) {
                const current = files.read(path);
                if (current !== undefined) files.remove(path, current);
            }
        }
    }
    for (const directory of emptyDirectories.toSorted((left, right) => right.length - left.length))
        files.rmdir(directory);
    files.mkdir('source', 0o700);
    for (const [path, next] of desired) {
        const current = files.read(path);
        if (!isDeepStrictEqual(current, next)) files.write(path, next, current);
    }
    return join(folder, 'source');
}
