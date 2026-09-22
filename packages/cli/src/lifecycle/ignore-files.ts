// An ignore file of a replaced tool holds paths somebody chose to leave out. They travel into the policy with the comment above them as the reason.
import { isReasonAccepted } from '#cli/policy/loosening.ts';

const COMMENT = '#';

// A line of an ignore file as a glob from the repository root: a bare name matches at any depth, and a folder matches what it holds.
function globOf(folder: string, line: string): string {
    const isFolder = line.endsWith('/');
    const name = line.replaceAll(/^\/|\/$/gu, '');
    const isAnchored = line.startsWith('/') || name.includes('/');
    const base = folder === '' ? '' : `${folder}/`;
    return `${base}${isAnchored ? '' : '**/'}${name}${isFolder ? '/**' : ''}`;
}

// A comment of a word or two is a label, which the policy refuses as a reason; it travels with where it came from.
function reasonFrom(path: string, comment: string): string {
    const carried = `carried from ${path} at init`;
    if (comment === '') return carried;
    return isReasonAccepted(comment) ? comment : `${carried}: ${comment}`;
}

/**
 * The entries of one ignore file: each run of lines under a comment is one entry with that comment as its reason.
 * @param text the contents already read from the ignore file
 * @param path the ignore file, relative to the root
 * @returns the entries, each with its globs and its reason
 */
export function ignoreFileEntries(text: string, path: string): { paths: string[]; reason: string }[] {
    const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const entries: { paths: string[]; reason: string }[] = [];
    let reason = `carried from ${path} at init`;
    let current: string[] = [];
    const flush = (): void => {
        if (current.length > 0) entries.push({ paths: current, reason });
        current = [];
    };
    const lines = text.split('\n');
    for (const raw of lines) {
        const line = raw.trim();
        if (line.startsWith(COMMENT)) {
            flush();
            reason = reasonFrom(path, line.slice(1).trim());
        } else if (line.startsWith('!'))
            throw new Error(`${path}: ordered negation ${JSON.stringify(line)} requires explicit conversion.`);
        else if (line !== '') current.push(globOf(folder, line));
    }
    flush();
    return entries;
}
