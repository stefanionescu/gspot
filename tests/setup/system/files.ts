// Reads file trees and checks whether paths exist.
import { join } from 'node:path';
import { open, lstat, access, readdir, readlink } from 'node:fs/promises';

/**
 * Reads every path in a repository with its mode and contents, to check that a write kept them.
 *
 * @param repositoryRoot folder to read.
 * @returns each path and its mode and contents.
 */
export async function readTree(repositoryRoot: string): Promise<Record<string, string>> {
    const entries = await readdir(repositoryRoot, { recursive: true });
    return Object.fromEntries(
        await Promise.all(
            entries.map(async (path) => {
                const full = join(repositoryRoot, path);
                const attributes = await lstat(full);
                let bytes = 'directory';
                if (attributes.isSymbolicLink()) bytes = `symlink:${await readlink(full)}`;
                else if (attributes.isFile()) {
                    await using file = await open(full, 'r');
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
 * Checks whether a filesystem path exists, following symbolic links.
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
