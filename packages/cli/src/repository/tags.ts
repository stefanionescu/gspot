// File tags computed the way pre-commit's identify does: extension, filename, shebang, executable bit, content.
import { posix } from 'node:path';
import { extensionOf } from '#cli/platform/paths.ts';
import { parseShebang } from '#cli/parsers/shebang.ts';
import { lockfileEntry } from '#cli/parsers/lockfiles.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/packages.ts';
import type { Tagged, RawEntry, ContentPrefix } from '#cli/types/repository/inventory.ts';

import {
    RUNTIME_TAG,
    SHEBANG_TAG,
    SHEBANG_TAGS,
    FILENAME_TAGS,
    EXTENSION_TAGS,
    BINARY_EXTENSIONS,
    INTERPRETER_DIALECTS,
    SHEBANG_INTERPRETERS,
} from '#cli/config/repository/inventory.ts';

function sniff(buffer: Buffer): ContentPrefix {
    if (buffer.includes(0)) return { isBinary: true, firstLine: '' };
    const text = buffer.toString('utf8');
    const newline = text.indexOf('\n');
    return { isBinary: false, firstLine: newline === -1 ? text : text.slice(0, newline) };
}

function shebangTags(firstLine: string): string[] {
    const interpreter = parseShebang(firstLine);
    if (interpreter === undefined) return [];
    const shebang = SHEBANG_INTERPRETERS[interpreter] ?? SHEBANG_INTERPRETERS[withoutTrailingVersion(interpreter)];
    if (shebang === undefined) return [];
    const dialect = INTERPRETER_DIALECTS[interpreter] ?? 'bash';
    const runtime = JAVASCRIPT_RUNTIMES.find((name) => name === interpreter);
    return [
        ...(SHEBANG_TAGS[shebang] ?? []),
        `${SHEBANG_TAG}${shebang}`,
        ...(shebang === 'shell' ? [dialect] : []),
        ...(runtime === undefined ? [] : [`${RUNTIME_TAG}${runtime}`]),
    ];
}

function textTags(tags: Set<string>, firstLine: string): Tagged {
    for (const tag of shebangTags(firstLine)) tags.add(tag);
    if (Object.values(INTERPRETER_DIALECTS).some((dialect) => tags.has(dialect))) tags.delete('bash');
    tags.add('text');
    return { tags: [...tags], binary: false };
}

function withoutTrailingVersion(word: string): string {
    let end = word.length;
    while (end > 0 && '0123456789.'.includes(word[end - 1] ?? '')) end -= 1;
    return word.slice(0, end);
}

/**
 * Tags for one entry. Binary files retain path tags and do not receive content tags.
 * @param entry the tracked entry
 * @param prefix the captured first bytes
 * @returns the path and content tags, and whether the file is binary
 */
export function tagEntry(entry: RawEntry, prefix: Buffer): Tagged {
    const extension = extensionOf(entry.path);
    const base = posix.basename(entry.path);
    const flags: [boolean, string][] = [
        [entry.symlink, 'symlink'],
        [lockfileEntry(base) !== undefined, 'lockfile'],
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
 * Identify Swift imports, test declarations, and package targets without matching comment or string text.
 * @param text the Swift source
 * @returns the imported modules, test frameworks, and target kinds the source declares
 */
export async function swiftSourceTags(text: string): Promise<string[]> {
    const tree = await parseSource('swift', text);
    try {
        const imports = tree.rootNode
            .descendantsOfType('import_declaration')
            .map((node) => node.namedChildren.find((child) => child.type === 'identifier')?.text.split('.', 1)[0])
            .filter((name) => name !== undefined);
        const attributes = tree.rootNode.descendantsOfType('attribute');
        const isTest =
            imports.some((name) => name === 'XCTest' || name === 'Testing') ||
            attributes.some((node) => {
                const name = node.namedChildren.find((child) => child.type === 'user_type')?.text;
                return name !== undefined && ['Test', 'Suite', 'Testing.Test', 'Testing.Suite'].includes(name);
            });
        const hasTarget = tree.rootNode
            .descendantsOfType('call_expression')
            .some((node) => ['.testTarget', 'Target.testTarget'].includes(node.firstNamedChild?.text ?? ''));
        return [
            ...new Set(imports.map((name) => `swift-import:${name}`)),
            ...(isTest ? ['swift-test'] : []),
            ...(hasTarget ? ['swift-test-target'] : []),
        ];
    } finally {
        tree.delete();
    }
}

/**
 * Extensions whose authoritative inventory tags include any requested language or content tag.
 * @param tags the language or content tags to select
 * @returns extensions in inventory order
 */
export function extensionsTagged(...tags: string[]): string[] {
    return Object.entries(EXTENSION_TAGS)
        .filter(([, owned]) => tags.some((tag) => owned.includes(tag)))
        .map(([extension]) => extension);
}
