// File tags computed the way pre-commit's identify does: extension, filename, shebang, executable bit, content.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BINARY_SNIFF_BYTES, EXTENSION_TAGS, FILENAME_TAGS, SHEBANG_TAGS } from '#config/file-tags.ts';
import { BINARY_EXTENSIONS, LOCKFILE_NAMES } from '#config/patterns.ts';
import { baseName, extensionOf } from '#cli/platform/paths.ts';
import { shebangInterpreter } from '#cli/presets/detect.ts';
import type { RawEntry } from '#cli/repository/tracked.ts';

export type Tagged = { tags: string[]; binary: boolean; shebang?: string };

function sniff(root: string, path: string): { binary: boolean; firstLine: string } {
    let buffer: Buffer;
    try {
        const file = Bun.file(join(root, path));
        const size = Math.min(file.size, BINARY_SNIFF_BYTES);
        buffer = Buffer.from(readFileSync(join(root, path)).subarray(0, size));
    } catch {
        return { binary: false, firstLine: '' };
    }
    if (buffer.includes(0)) return { binary: true, firstLine: '' };
    const text = buffer.toString('utf8');
    const newline = text.indexOf('\n');
    return { binary: false, firstLine: newline === -1 ? text : text.slice(0, newline) };
}

/** Tags for one entry. Binary files get `binary` and nothing else. */
export function tagEntry(root: string, entry: RawEntry): Tagged {
    const ext = extensionOf(entry.path);
    const base = baseName(entry.path);
    const tags = new Set<string>();
    if (entry.symlink) tags.add('symlink');
    if (LOCKFILE_NAMES.includes(base)) tags.add('lockfile');
    if (BINARY_EXTENSIONS.includes(ext)) return { tags: ['binary', ...tags], binary: true };
    for (const tag of EXTENSION_TAGS[ext] ?? []) tags.add(tag);
    for (const tag of FILENAME_TAGS[base] ?? []) tags.add(tag);
    if (base.startsWith('Dockerfile') || ext === '.dockerfile') tags.add('dockerfile');
    if (base.startsWith('.env')) tags.add('dotenv');
    if (entry.executable) tags.add('executable');
    const needsSniff = ext === '' || !tags.has('text') || entry.executable;
    let shebang: string | undefined;
    if (needsSniff && !entry.symlink && entry.size > 0) {
        const { binary, firstLine } = sniff(root, entry.path);
        if (binary) return { tags: ['binary', ...tags], binary: true };
        if (firstLine.startsWith('#!')) {
            shebang = shebangInterpreter(firstLine);
            if (shebang !== undefined) {
                for (const tag of SHEBANG_TAGS[shebang] ?? []) tags.add(tag);
                tags.add(`shebang:${shebang}`);
                const interpreter = firstLine.match(/\/([a-z0-9]+)\s*$/)?.[1] ?? firstLine.split(/\s+/).pop() ?? '';
                if (interpreter === 'zsh') tags.add('zsh');
            }
        }
        tags.add('text');
    }
    if (!tags.has('text') && !tags.has('binary')) tags.add('text');
    return shebang === undefined ? { tags: [...tags], binary: false } : { tags: [...tags], binary: false, shebang };
}
