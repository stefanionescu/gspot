import { join } from 'node:path';
import { open, lstat, access, readdir, readlink } from 'node:fs/promises';

/**
Read every path in a repository with its mode and contents, to check that a write kept them.

@param root folder to read.
@returns each path and its mode and contents.
*/
export async function readTree(root: string): Promise<Record<string, string>> {
    const paths = await readdir(root, { recursive: true });
    return Object.fromEntries(
        await Promise.all(
            paths.map(async (path) => {
                const absolute = join(root, path);
                const attributes = await lstat(absolute);
                if (attributes.isSymbolicLink())
                    return [path, `${String(attributes.mode)}:symlink:${await readlink(absolute)}`] as const;
                if (!attributes.isFile()) return [path, `${String(attributes.mode)}:directory`] as const;
                await using file = await open(absolute, 'r');
                const content = await file.readFile();
                const fileAttributes = await file.stat();
                return [path, `${String(fileAttributes.mode)}:file:${content.toString('base64')}`] as const;
            }),
        ),
    );
}

/**
Check whether a filesystem path exists, following symbolic links.

@param path the file or folder.
@returns whether the path exists; false when access fails.
*/
export async function isOnDisk(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}
