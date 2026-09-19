// An ignore file of a replaced tool holds paths somebody chose to leave out. They travel into the policy with the comment above them as the reason.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const COMMENT = '#';

// A line of an ignore file as a glob from the repository root: a bare name matches at any depth, and a folder matches what it holds.
function globOf(folder: string, line: string): string {
    const isFolder = line.endsWith('/');
    const name = line.replaceAll(/^\/|\/$/gu, '');
    const isAnchored = line.startsWith('/') || name.includes('/');
    const base = folder === '' ? '' : `${folder}/`;
    return `${base}${isAnchored ? '' : '**/'}${name}${isFolder ? '/**' : ''}`;
}

/**
 * The entries of one ignore file: each run of lines under a comment is one entry with that comment as its reason.
 * @param root the repository root
 * @param path the ignore file, relative to the root
 * @returns the entries, each with its globs and its reason
 */
export function ignoreFileEntries(root: string, path: string): { paths: string[]; reason: string }[] {
    const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const entries: { paths: string[]; reason: string }[] = [];
    let reason = `carried from ${path} at init`;
    let current: string[] = [];
    const flush = (): void => {
        if (current.length > 0) entries.push({ paths: current, reason });
        current = [];
    };
    const lines = readFileSync(join(root, path), 'utf8').split('\n');
    for (const raw of lines) {
        const line = raw.trim();
        if (line.startsWith(COMMENT)) {
            flush();
            reason = line.slice(1).trim() || reason;
        } else if (line !== '' && !line.startsWith('!')) current.push(globOf(folder, line));
    }
    flush();
    return entries;
}
