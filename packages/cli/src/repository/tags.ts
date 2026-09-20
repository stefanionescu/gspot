// File tags computed the way pre-commit's identify does: extension, filename, shebang, executable bit, content.
import { readPrefix } from '#cli/repository/tracked.ts';
import { shebangInterpreter } from '#cli/presets/detect.ts';
import type { Tagged, RawEntry } from '#types/repository.ts';
import { baseName, extensionOf } from '#cli/platform/paths.ts';
import { BINARY_EXTENSIONS, LOCKFILE_NAMES } from '#config/patterns.ts';
import { BINARY_SNIFF_BYTES, EXTENSION_TAGS, FILENAME_TAGS, SHEBANG_TAGS } from '#config/file-tags.ts';

function sniff(root: string, path: string): { isBinary: boolean; firstLine: string } {
    const buffer = readPrefix(root, path, BINARY_SNIFF_BYTES);
    if (buffer.includes(0)) return { isBinary: true, firstLine: '' };
    const text = buffer.toString('utf8');
    const newline = text.indexOf('\n');
    return { isBinary: false, firstLine: newline === -1 ? text : text.slice(0, newline) };
}

function flagTags(entry: RawEntry, base: string, extension: string): string[] {
    const flags: [boolean, string][] = [
        [entry.symlink, 'symlink'],
        [LOCKFILE_NAMES.includes(base), 'lockfile'],
        [base.startsWith('Dockerfile') || extension === '.dockerfile', 'dockerfile'],
        [base.startsWith('.env'), 'dotenv'],
        [entry.executable, 'executable'],
    ];
    return flags.filter(([isSet]) => isSet).map(([, tag]) => tag);
}

function nameTags(entry: RawEntry, base: string, extension: string): Set<string> {
    return new Set<string>([
        ...(EXTENSION_TAGS[extension] ?? []),
        ...(FILENAME_TAGS[base] ?? []),
        ...flagTags(entry, base, extension),
    ]);
}

function shebangTags(firstLine: string): { shebang: string | undefined; tags: string[] } {
    if (!firstLine.startsWith('#!')) return { shebang: undefined, tags: [] };
    const shebang = shebangInterpreter(firstLine);
    if (shebang === undefined) return { shebang, tags: [] };
    const lastWord = firstLine.trim().split(/\s+/u).pop() ?? '';
    const interpreter = lastWord.slice(lastWord.lastIndexOf('/') + 1);
    return {
        shebang,
        tags: [...(SHEBANG_TAGS[shebang] ?? []), `shebang:${shebang}`, ...(interpreter === 'zsh' ? ['zsh'] : [])],
    };
}

function requiresSniff(entry: RawEntry, tags: Set<string>, extension: string): boolean {
    if (entry.symlink || entry.size === 0) return false;
    return extension === '' || !tags.has('text') || entry.executable;
}

function textTags(tags: Set<string>, firstLine: string): Tagged {
    const { shebang, tags: fromShebang } = shebangTags(firstLine);
    for (const tag of fromShebang) tags.add(tag);
    tags.add('text');
    return shebang === undefined ? { tags: [...tags], binary: false } : { tags: [...tags], binary: false, shebang };
}

/**
 * Tags for one entry. Binary files get `binary` and nothing else.
 * @param root the repository root
 * @param entry the tracked entry
 * @returns the tags, whether the file is binary, and the shebang interpreter when there is one
 */
export function tagEntry(root: string, entry: RawEntry): Tagged {
    const extension = extensionOf(entry.path);
    const base = baseName(entry.path);
    const tags = nameTags(entry, base, extension);
    if (BINARY_EXTENSIONS.includes(extension)) return { tags: ['binary', ...tags], binary: true };
    const sniffed = requiresSniff(entry, tags, extension)
        ? sniff(root, entry.path)
        : { isBinary: false, firstLine: '' };
    if (sniffed.isBinary) return { tags: ['binary', ...tags], binary: true };
    return textTags(tags, sniffed.firstLine);
}
