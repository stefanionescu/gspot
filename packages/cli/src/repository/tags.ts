// File tags computed the way pre-commit's identify does: extension, filename, shebang, executable bit, content.
import type { Tagged, RawEntry } from '#cli/repository/types.ts';
import { baseName, extensionOf } from '#cli/platform/paths.ts';
import { BINARY_EXTENSIONS, LOCKFILE_NAMES } from '#cli/lifecycle/patterns-definitions.ts';
import { shebangExecutable, shebangInterpreter } from '#cli/presets/detect.ts';
import { EXTENSION_TAGS, FILENAME_TAGS, SHEBANG_TAGS } from '#cli/repository/file-tags-definitions.ts';

function sniff(buffer: Buffer): { isBinary: boolean; firstLine: string } {
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

function shebangTags(firstLine: string): { shebang: string | undefined; tags: string[] } {
    if (!firstLine.startsWith('#!')) return { shebang: undefined, tags: [] };
    const shebang = shebangInterpreter(firstLine);
    if (shebang === undefined) return { shebang, tags: [] };
    const interpreter = shebangExecutable(firstLine);
    const dialect = interpreter === 'zsh' || interpreter === 'bats' ? interpreter : 'bash';
    return {
        shebang,
        tags: [...(SHEBANG_TAGS[shebang] ?? []), `shebang:${shebang}`, ...(shebang === 'shell' ? [dialect] : [])],
    };
}

function textTags(tags: Set<string>, firstLine: string): Tagged {
    const { shebang, tags: fromShebang } = shebangTags(firstLine);
    for (const tag of fromShebang) tags.add(tag);
    if (tags.has('zsh') || tags.has('bats')) tags.delete('bash');
    tags.add('text');
    return shebang === undefined ? { tags: [...tags], binary: false } : { tags: [...tags], binary: false, shebang };
}

/**
 * Tags for one entry. Binary files get `binary` and nothing else.
 * @param entry the tracked entry
 * @param prefix the captured first bytes
 * @returns the tags, whether the file is binary, and the shebang interpreter when there is one
 */
export function tagEntry(entry: RawEntry, prefix: Buffer): Tagged {
    const extension = extensionOf(entry.path);
    const base = baseName(entry.path);
    const tags = new Set<string>([
        ...(EXTENSION_TAGS[extension] ?? []),
        ...(FILENAME_TAGS[base] ?? []),
        ...flagTags(entry, base, extension),
    ]);
    if (BINARY_EXTENSIONS.includes(extension)) return { tags: ['binary', ...tags], binary: true };
    const sniffed = sniff(prefix);
    if (sniffed.isBinary) return { tags: ['binary', ...tags], binary: true };
    return textTags(tags, sniffed.firstLine);
}
