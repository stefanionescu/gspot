import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { openConfinedRoot } from '#cli/filesystem/confined.ts';

/** Copy selected files and declared configurations without native discovery inputs. */
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
            [Symbol.dispose]: () => rmSync(directory, { recursive: true, force: true }),
        };
    } catch (error) {
        rmSync(directory, { recursive: true, force: true });
        throw error;
    }
}
