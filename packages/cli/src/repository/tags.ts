// File tags computed the way pre-commit's identify does: extension, filename, shebang, executable bit, content.
import type { RawEntry } from '#cli/repository/tracked.ts';
import { baseName, extensionOf } from '#cli/platform/paths.ts';
import { BINARY_EXTENSIONS, LOCKFILE_NAMES } from '#cli/repository/patterns.ts';
import { shebangExecutable, shebangInterpreter } from '#cli/configurations/detect.ts';

const EXTENSION_TAGS: Record<string, string[]> = {
    '.sh': ['shell', 'bash', 'text'],
    '.bash': ['shell', 'bash', 'text'],
    '.zsh': ['shell', 'zsh', 'text'],
    '.bats': ['shell', 'bats', 'text'],
    '.py': ['python', 'text'],
    '.pyi': ['python', 'pyi', 'text'],
    '.js': ['javascript', 'text'],
    '.mjs': ['javascript', 'text'],
    '.cjs': ['javascript', 'text'],
    '.jsx': ['javascript', 'jsx', 'text'],
    '.ts': ['typescript', 'text'],
    '.mts': ['typescript', 'text'],
    '.cts': ['typescript', 'text'],
    '.tsx': ['typescript', 'tsx', 'text'],
    '.vue': ['vue', 'source', 'text'],
    '.svelte': ['svelte', 'source', 'text'],
    '.swift': ['swift', 'text'],
    '.sql': ['sql', 'text'],
    '.pgsql': ['sql', 'text'],
    '.psql': ['sql', 'text'],
    '.md': ['markdown', 'text'],
    '.mdx': ['markdown', 'text'],
    '.json': ['json', 'text'],
    '.jsonc': ['json', 'jsonc', 'text'],
    '.json5': ['json', 'text'],
    '.yml': ['yaml', 'text'],
    '.yaml': ['yaml', 'text'],
    '.toml': ['toml', 'text'],
    '.ini': ['ini', 'text'],
    '.cfg': ['ini', 'text'],
    '.css': ['css', 'text'],
    '.scss': ['scss', 'text'],
    '.html': ['html', 'text'],
    '.htm': ['html', 'text'],
    '.xml': ['xml', 'text'],
    '.plist': ['plist', 'xml', 'text'],
    '.entitlements': ['plist', 'xml', 'text'],
    '.xcconfig': ['xcconfig', 'text'],
    '.xcstrings': ['json', 'xcstrings', 'text'],
    '.storyboard': ['xml', 'text'],
    '.xib': ['xml', 'text'],
    '.svg': ['svg', 'xml', 'text'],
    '.txt': ['text'],
    '.env': ['dotenv', 'text'],
    '.conf': ['text'],
    '.webmanifest': ['json', 'text'],
};

const FILENAME_TAGS: Record<string, string[]> = {
    Dockerfile: ['dockerfile', 'text'],
    Makefile: ['makefile', 'text'],
    '.gitignore': ['text'],
    '.gitattributes': ['text'],
    '.editorconfig': ['ini', 'text'],
    '.nvmrc': ['text'],
    '.node-version': ['text'],
    '.python-version': ['text'],
    _headers: ['text'],
    _redirects: ['text'],
    LICENSE: ['text'],
    'LICENSE.md': ['markdown', 'text'],
    CODEOWNERS: ['text'],
};

const SHEBANG_TAGS: Record<string, string[]> = {
    shell: ['shell', 'executable', 'text'],
    python: ['python', 'executable', 'text'],
    node: ['javascript', 'node', 'executable', 'text'],
};

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
 * Tags for one entry. Binary files retain path tags and do not receive content tags.
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

export type Tagged = { tags: string[]; binary: boolean; shebang?: string };
