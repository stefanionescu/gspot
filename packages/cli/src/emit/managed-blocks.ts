// Marker blocks in CLAUDE.md, AGENTS.md, .gitignore, .vscode/*.json and lefthook.yml; text outside the markers is never read or moved.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HASH_BLOCK_END, HASH_BLOCK_START, MANAGED_BLOCK_END, MANAGED_BLOCK_START } from '#config/markers.ts';

export type BlockStyle = 'markdown' | 'hash';

function markers(style: BlockStyle): { start: string; end: string } {
    return style === 'markdown'
        ? { start: MANAGED_BLOCK_START, end: MANAGED_BLOCK_END }
        : { start: HASH_BLOCK_START, end: HASH_BLOCK_END };
}

/** Puts the block into the text: replaces the existing block between markers, or appends one. */
export function withBlock(existing: string, block: string, style: BlockStyle): string {
    const { start, end } = markers(style);
    const body = `${start}\n${block.trim()}\n${end}\n`;
    const startIndex = existing.indexOf(start);
    const endIndex = existing.indexOf(end);
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        return `${existing.slice(0, startIndex)}${body}${existing.slice(endIndex + end.length).replace(/^\n/, '')}`;
    }
    if (existing.trim() === '') return body;
    return `${existing.replace(/\n*$/, '\n\n')}${body}`;
}

/** Removes the block; returns the text without it. */
export function withoutBlock(existing: string, style: BlockStyle): string {
    const { start, end } = markers(style);
    const startIndex = existing.indexOf(start);
    const endIndex = existing.indexOf(end);
    if (startIndex === -1 || endIndex === -1) return existing;
    const before = existing.slice(0, startIndex).replace(/\n+$/, '\n');
    const after = existing.slice(endIndex + end.length).replace(/^\n+/, '');
    const joined = `${before}${after}`;
    return joined.trim() === '' ? '' : joined;
}

/** The block currently in a file, or undefined. */
export function currentBlock(text: string, style: BlockStyle): string | undefined {
    const { start, end } = markers(style);
    const startIndex = text.indexOf(start);
    const endIndex = text.indexOf(end);
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) return undefined;
    return text.slice(startIndex + start.length, endIndex).trim();
}

/** The text of a file, or '' when absent. */
export function fileText(root: string, path: string): string {
    const full = join(root, path);
    return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

/** The .gitignore block: the three untracked paths. */
export function gitignoreBlock(): string {
    return [
        'gspot.local.toml',
        '.gspot/cache/',
        '.gspot/last.json',
        '.gspot/last.sarif',
        '.gspot/vale/styles/Google/',
        '.gspot/vale/styles/Microsoft/',
        '.gspot/vale/styles/write-good/',
        '.gspot/vale/styles/proselint/',
        '.gspot/vale/styles/alex/',
        '.gspot/vale/styles/RedHat/',
        '.gspot/vale/styles/Readability/',
    ].join('\n');
}
