import { join } from 'node:path';
import { readdirSync, readFileSync, lstatSync, readlinkSync } from 'node:fs';

/**
 * Captures repository paths, file contents, and modes for write-preservation tests.
 * @param root the repository directory
 * @returns each path and its mode and contents
 */
export function treeContents(root: string): Record<string, string> {
    return Object.fromEntries(
        readdirSync(root, { recursive: true }).map((entry) => {
            const path = String(entry);
            const full = join(root, path);
            const attributes = lstatSync(full);
            const bytes = attributes.isSymbolicLink()
                ? `symlink:${readlinkSync(full)}`
                : attributes.isFile()
                  ? `file:${readFileSync(full).toString('base64')}`
                  : 'directory';
            return [path, `${String(attributes.mode)}:${bytes}`];
        }),
    );
}
