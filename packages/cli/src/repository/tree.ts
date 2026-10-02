// Builds the Repository record: the file set with kinds and tags, and the scopes.
import { baseName } from '#cli/platform/paths.ts';
import { tagEntry } from '#cli/repository/tags.ts';
import { parserFor } from '#cli/parsers/tree-sitter.ts';
import { kindOf, readAttributes } from '#cli/repository/kind.ts';
import { readPrefix, readSource } from '#cli/repository/sources.ts';
import { FILE_PREFIX_BYTES } from '#cli/config/repository/repository.ts';
import { trackedEntries, isGitRepository } from '#cli/repository/tracked.ts';

import type {
    Tagged,
    Verdict,
    RawEntry,
    Repository,
    ScopeEntry,
    TrackedFile,
    FileDeclaration,
} from '#cli/types/repository/repository.ts';

function trackedFile(entry: RawEntry, prefix: Buffer, tagged: Tagged, verdict: Verdict): TrackedFile {
    const file: TrackedFile = {
        path: entry.path,
        prefix,
        kind: verdict.kind,
        kindSource: verdict.source,
        tags: tagged.tags,
        executable: entry.executable,
        size: entry.size,
    };
    if (verdict.producedBy !== undefined) file.producedBy = verdict.producedBy;
    return file;
}

/**
 * Identify Swift imports, test declarations, and package targets without matching comment or string text.
 * @param text the Swift source
 * @returns the imported modules, test frameworks, and target kinds the source declares
 */
async function swiftSourceTags(text: string): Promise<string[]> {
    const parser = await parserFor('swift');
    const tree = parser.parse(text);
    if (tree === null) throw new Error('Swift source detection could not parse the source.');
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
 * Reads the tree once: every tracked or about-to-be-tracked file with its kind and tags.
 * @param root the repository root
 * @param declarations the generated and vendored declarations
 * @param scopeEntries the [[scope]] entries
 * @param exclude paths and directory patterns excluded before reading content
 * @returns the repository record
 */
export async function readRepository(
    root: string,
    declarations: FileDeclaration[],
    scopeEntries: { path: string; kits: string[] }[],
    exclude: string[],
): Promise<Repository> {
    const entries = trackedEntries(root, exclude);
    const files: TrackedFile[] = [];
    const attributes = readAttributes(root);
    for (const entry of entries) {
        const prefix = entry.symlink ? Buffer.alloc(0) : readPrefix(root, entry.path, FILE_PREFIX_BYTES);
        const tagged = tagEntry(entry, prefix);
        const verdict = kindOf(entry.path, declarations, tagged.binary, prefix, attributes);
        const file = trackedFile(entry, prefix, tagged, verdict);
        if (!entry.symlink && file.kind === 'source' && file.path.endsWith('.swift')) {
            const tags = await swiftSourceTags(readSource(root, file.path).toString('utf8'));
            file.tags.push(
                ...tags.filter((tag) => tag !== 'swift-test-target' || file.path.split('/').at(-1) === 'Package.swift'),
            );
        }
        files.push(file);
    }
    return {
        root,
        attributes,
        hasGit: isGitRepository(root),
        files,
        scopes: [
            { name: 'root', path: '', kits: [], source: 'root' },
            ...scopeEntries.map(
                (entry): ScopeEntry => ({
                    name: baseName(entry.path),
                    path: entry.path,
                    kits: entry.kits,
                    source: 'gspot.toml',
                }),
            ),
        ],
    };
}
