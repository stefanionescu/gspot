// Marker blocks in `CLAUDE.md`, `AGENTS.md`, .gitignore, .vscode/*.json and lefthook.yml; text outside the markers is never read or moved.
import { join } from 'node:path';
import type { BlockStyle } from '#types/emit.ts';
import { existsSync, readFileSync } from 'node:fs';
import { HASH_BLOCK_END, HASH_BLOCK_START, MANAGED_BLOCK_END, MANAGED_BLOCK_START } from '#config/markers.ts';

const GITIGNORE_LINES = [
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
    '.gspot/vale/styles/Harper/',
    '.gspot/vale/styles/.vale-config/',
    '.gspot/vale/styles/config/dictionaries/',
];

function markers(style: BlockStyle): { start: string; end: string } {
    return style === 'markdown'
        ? { start: MANAGED_BLOCK_START, end: MANAGED_BLOCK_END }
        : { start: HASH_BLOCK_START, end: HASH_BLOCK_END };
}

function withoutTrailingNewlines(text: string): string {
    let end = text.length;
    while (end > 0 && text[end - 1] === '\n') end -= 1;
    return text.slice(0, end);
}

function withoutLeadingNewlines(text: string): string {
    let start = 0;
    while (start < text.length && text[start] === '\n') start += 1;
    return text.slice(start);
}

/**
 * Puts the block into the text: replaces the existing block between markers, or appends one.
 * @param existing the file's text
 * @param block the block body
 * @param style markdown or hash markers
 * @returns the new text
 */
export function applyBlock(existing: string, block: string, style: BlockStyle): string {
    const { start, end } = markers(style);
    const gap = style === 'markdown' ? '\n\n' : '\n';
    const body = `${start}${gap}${block.trim()}${gap}${end}\n`;
    const startIndex = existing.indexOf(start);
    const endIndex = existing.indexOf(end);
    if (startIndex !== -1 && endIndex > startIndex) {
        const after = existing.slice(endIndex + end.length);
        return `${existing.slice(0, startIndex)}${body}${after.startsWith('\n') ? after.slice(1) : after}`;
    }
    if (existing.trim() === '') return body;
    return `${withoutTrailingNewlines(existing)}\n\n${body}`;
}

/**
 * Removes the block; returns the text without it.
 * @param existing the file's text
 * @param style markdown or hash markers
 * @returns the text without the block, '' when nothing else was there
 */
export function withoutBlock(existing: string, style: BlockStyle): string {
    const { start, end } = markers(style);
    const startIndex = existing.indexOf(start);
    const endIndex = existing.indexOf(end);
    if (startIndex === -1 || endIndex === -1) return existing;
    const before = existing.slice(0, startIndex);
    const head = before === '' ? '' : `${withoutTrailingNewlines(before)}\n`;
    const joined = `${head}${withoutLeadingNewlines(existing.slice(endIndex + end.length))}`;
    return joined.trim() === '' ? '' : joined;
}

/**
 * The block currently in a file, or undefined.
 * @param text the file's text
 * @param style markdown or hash markers
 * @returns the block body, trimmed
 */
export function currentBlock(text: string, style: BlockStyle): string | undefined {
    const { start, end } = markers(style);
    const startIndex = text.indexOf(start);
    const endIndex = text.indexOf(end);
    if (startIndex === -1 || endIndex < startIndex) return undefined;
    return text.slice(startIndex + start.length, endIndex).trim();
}

/**
 * The text of a file, or '' when absent.
 * @param root the repository root
 * @param path the file, relative to the root
 * @returns the text
 */
export function fileText(root: string, path: string): string {
    const full = join(root, path);
    return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

/**
 * The .gitignore block: the paths gspot writes that git never tracks.
 * @returns the block body
 */
export function gitignoreBlock(): string {
    return GITIGNORE_LINES.join('\n');
}
