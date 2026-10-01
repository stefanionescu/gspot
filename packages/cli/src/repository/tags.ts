// File tags computed the way pre-commit's identify does: extension, filename, shebang, executable bit, content.
import { baseName, extensionOf } from '#cli/platform/paths.ts';
import type { Tagged, RawEntry } from '#cli/types/repository/repository.ts';
import { LOCKFILE_NAMES, BINARY_EXTENSIONS, SHEBANG_INTERPRETERS } from '#cli/config/repository/patterns.ts';
import { ENV_SUFFIX, SHEBANG_TAGS, FILENAME_TAGS, EXTENSION_TAGS } from '#cli/config/repository/repository.ts';

function sniff(buffer: Buffer): { isBinary: boolean; firstLine: string } {
    if (buffer.includes(0)) return { isBinary: true, firstLine: '' };
    const text = buffer.toString('utf8');
    const newline = text.indexOf('\n');
    return { isBinary: false, firstLine: newline === -1 ? text : text.slice(0, newline) };
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

function withoutTrailingVersion(word: string): string {
    let end = word.length;
    while (end > 0 && '0123456789.'.includes(word[end - 1] ?? '')) end -= 1;
    return word.slice(0, end);
}

/**
 * Reads the executable token, including env -S and interpreter arguments.
 * @param firstLine the first line of the file
 * @returns the executable basename or undefined without a shebang
 */
function shebangExecutable(firstLine: string): string | undefined {
    if (!firstLine.startsWith('#!')) return undefined;
    const tokens = firstLine.slice('#!'.length).trim().split(/\s+/u);
    let index = 0;
    if (tokens[index]?.endsWith(ENV_SUFFIX) === true) index += 1;
    if (tokens[index] === '-S') index += 1;
    const word = tokens[index];
    return word === undefined || word === '' ? undefined : word.slice(word.lastIndexOf('/') + 1);
}
/**
 * Tags for one entry. Binary files retain path tags and do not receive content tags.
 * @param entry the tracked entry
 * @param prefix the captured first bytes
 * @returns the tags, whether the file is binary, and the shebang interpreter when there is one
 */
export function tagEntry(entry: RawEntry, prefix: Buffer): Tagged {
    const extension = extensionOf(entry.path);
    const base = baseName(entry.path);
    const flags: [boolean, string][] = [
        [entry.symlink, 'symlink'],
        [LOCKFILE_NAMES.includes(base), 'lockfile'],
        [base.startsWith('Dockerfile') || extension === '.dockerfile', 'dockerfile'],
        [base.startsWith('.env'), 'dotenv'],
        [entry.executable, 'executable'],
    ];
    const tags = new Set<string>([
        ...(EXTENSION_TAGS[extension] ?? []),
        ...(FILENAME_TAGS[base] ?? []),
        ...flags.filter(([isSet]) => isSet).map(([, tag]) => tag),
    ]);
    if (BINARY_EXTENSIONS.includes(extension)) return { tags: ['binary', ...tags], binary: true };
    const sniffed = sniff(prefix);
    if (sniffed.isBinary) return { tags: ['binary', ...tags], binary: true };
    return textTags(tags, sniffed.firstLine);
}

/**
 * The interpreter a shebang names, or undefined.
 * @param firstLine the first line of the file
 * @returns the interpreter name the table knows
 */
export function shebangInterpreter(firstLine: string): string | undefined {
    const word = shebangExecutable(firstLine);
    if (word === undefined) return undefined;
    const stripped = withoutTrailingVersion(word);
    return SHEBANG_INTERPRETERS[word] ?? SHEBANG_INTERPRETERS[stripped];
}
