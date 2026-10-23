// Reads file trees and checks whether paths exist.
import { join } from 'node:path';
import { open, lstat, access, readdir, readlink } from 'node:fs/promises';

/**
 * Read every path in a repository with its mode and contents, to check that a write kept them.
 *
 * @param repositoryRoot folder to read.
 * @returns each path and its mode and contents.
 */
export async function readTree(repositoryRoot: string): Promise<Record<string, string>> {
    const paths = await readdir(repositoryRoot, { recursive: true });
    return Object.fromEntries(
        await Promise.all(
            paths.map(async (path) => {
                const absolute = join(repositoryRoot, path);
                const attributes = await lstat(absolute);
                let bytes = 'directory';
                if (attributes.isSymbolicLink()) bytes = `symlink:${await readlink(absolute)}`;
                else if (attributes.isFile()) {
                    await using file = await open(absolute, 'r');
                    const content = await file.readFile();
                    const fileAttributes = await file.stat();
                    return [path, `${String(fileAttributes.mode)}:file:${content.toString('base64')}`] as const;
                }
                return [path, `${String(attributes.mode)}:${bytes}`] as const;
            }),
        ),
    );
}

/**
 * Check whether a filesystem path exists, following symbolic links.
 *
 * @param path the file or folder.
 * @returns whether the path exists; false when access fails.
 */
export function isOnDisk(path: string): Promise<boolean> {
    return access(path).then(
        () => true,
        () => false,
    );
}
