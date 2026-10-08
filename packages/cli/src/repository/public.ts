import { posix } from 'node:path';
import { hasHeader } from '#cli/parsers/public.ts';
import { extensionOf } from '#cli/platform/contracts.ts';
import { blockSpan } from '#cli/platform/root/contracts.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import { buildScope } from '#cli/repository/paths/contracts.ts';
import { runGitBlocking } from '#cli/platform/git/contracts.ts';
import { MANAGED_BLOCK_START } from '#cli/config/platform/managed-blocks.ts';
import { trackedEntries, readIndexEntries } from '#cli/repository/contracts.ts';
import { DOT_GSPOT, POLICY_FILE, STYLES_DIRECTORY } from '#cli/config/platform/locations.ts';
import { gitAttributes, attributeRules, resolvedAttributes } from '#cli/parsers/attributes.ts';
import { tagEntry, isGitRepository, swiftSourceTags } from '#cli/repository/discovery/contracts.ts';
import { openRoot, readText, readPrefix, readSource, createReadCache } from '#cli/platform/root/public.ts';

import type {
    Tagged,
    Verdict,
    RawEntry,
    Repository,
    ScopeEntry,
    TrackedFile,
    FileDeclaration,
    FileClassification,
    FileClassificationRules,
} from '#cli/types/repository/inventory.ts';
import {
    ROOT_SCOPE,
    NOTICE_FILE,
    SOURCE_KIND,
    BANNER_BYTES,
    LICENSE_FILE,
    LICENSE_TAGS,
    EXTENSION_TAGS,
    ENV_FILE_PATTERNS,
    FILE_PREFIX_BYTES,
    GENERATED_BANNERS,
    VALE_OWN_PREFIXES,
    ENV_TEMPLATE_NAMES,
    VENDORED_DIRECTORIES,
    GENERATED_BUILD_WRAPPERS,
} from '#cli/config/repository/inventory.ts';
// Reads the repository inventory, classifies source files, and records authored scopes.

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
// Every tracked path has one kind: source, generated, vendored, binary.

const matchesEnvironmentFile = pathMatcher(ENV_FILE_PATTERNS.map((pattern) => `**/${pattern}`));

function declaredKind(path: string, rules: FileClassificationRules): Verdict | undefined {
    const matched = rules.declarations.filter((entry) => pathMatcher(entry.paths)(path));
    const entry = matched.find(
        (declaration) => declaration.kind === 'vendored' || declaration.configuration === undefined,
    );
    if (entry === undefined)
        return (
            attributeKind(rules.attributes.get(path)) ??
            matched.map((declaration) => ({
                kind: declaration.kind,
                source:
                    declaration.kind === 'generated'
                        ? (declaration.configuration ?? declaration.kind)
                        : declaration.kind,
            }))[0]
        );
    return {
        kind: entry.kind,
        source: entry.kind,
        ...(entry.kind === 'generated' && entry.generator !== undefined ? { producedBy: entry.generator } : {}),
    };
}

function attributeKind(attributes: Record<string, string> | undefined): Verdict | undefined {
    if (attributes === undefined) return undefined;
    if (['set', 'true'].includes(attributes['linguist-generated'] ?? ''))
        return { kind: 'generated', source: '.gitattributes' };
    if (['set', 'true'].includes(attributes['linguist-vendored'] ?? ''))
        return { kind: 'vendored', source: '.gitattributes' };
    const isBinary = attributes['text'] === 'unset' || attributes['filter'] === 'lfs';
    return isBinary ? { kind: 'binary', source: '.gitattributes' } : undefined;
}

// A license text is another party's text. A code file whose name looks like a license stays source.
function isLicenseFile(path: string): boolean {
    const name = posix.basename(path);
    const tags = EXTENSION_TAGS[extensionOf(name)] ?? [];
    return (LICENSE_FILE.test(name) || NOTICE_FILE.test(name)) && tags.every((tag) => LICENSE_TAGS.has(tag));
}

// Tool paths and banners identify generated files; downloaded Vale styles are another party's text.
function classifyToolFile(path: string, prefix: Buffer): Verdict | undefined {
    if (isValePackageFile(path)) return { kind: 'vendored', source: 'gspot' };
    if (path.startsWith(`${DOT_GSPOT}/`)) return { kind: 'generated', source: 'gspot' };
    if (GENERATED_BUILD_WRAPPERS.has(posix.basename(path))) return { kind: 'generated', source: 'build wrapper' };
    const start = prefix.subarray(0, BANNER_BYTES).toString('utf8');
    if (hasHeader(start) || GENERATED_BANNERS.some((banner) => banner.test(start)))
        return { kind: 'generated', source: 'banner' };
    return undefined;
}

// Higher-priority kinds are resolved; only a wholly managed instruction document makes remaining content generated.
function sourceKind(root: string, entry: RawEntry, prefix: Buffer): Verdict {
    if (entry.symlink || !entry.path.endsWith('.md') || !prefix.includes(MANAGED_BLOCK_START)) return SOURCE_KIND;
    const text = readSource(root, entry.path).toString('utf8');
    const span = blockSpan(text, { path: entry.path, style: 'markdown' });
    if (span === undefined || `${text.slice(0, span.start)}${text.slice(span.end)}`.trim() !== '') return SOURCE_KIND;
    return { kind: 'generated', source: 'gspot' };
}

/**
 * Reads the tracked file inventory with source kinds, language tags, and authored scopes.
 * @param rootPath the repository root
 * @param declarations the generated and vendored declarations
 * @param scopeEntries the [[scope]] entries
 * @param exclude paths and directory patterns excluded before reading content
 * @param reads the session-owned canonical root and source reads
 * @returns the repository record
 */
export async function readRepository(
    rootPath: string,
    declarations: FileDeclaration[],
    scopeEntries: Pick<ScopeEntry, 'path' | 'configurations'>[],
    exclude: string[],
    reads: ReadCache = createReadCache(rootPath),
): Promise<Repository> {
    const root = reads.root;
    const index = await readIndexEntries(root);
    const entries = await trackedEntries(root, exclude, index);
    using directory = openRoot(root);
    const files: TrackedFile[] = [];
    const hasGit = isGitRepository(root);
    const attributes = readAttributes(
        root,
        entries.map((entry) => entry.path),
        hasGit,
    );
    for (const entry of entries) {
        const prefix = entry.symlink ? Buffer.alloc(0) : readPrefix(root, entry.path, FILE_PREFIX_BYTES, reads);
        const tagged = tagEntry(entry, prefix);
        const verdict = kindOf({ root, entry, isBinary: tagged.binary, prefix }, { declarations, attributes });
        const file = trackedFile(entry, prefix, tagged, verdict);
        if (!entry.symlink && file.kind === 'source' && file.path.endsWith('.swift')) {
            const tags = await swiftSourceTags(readSource(root, file.path, reads).toString('utf8'));
            file.tags.push(
                ...tags.filter((tag) => tag !== 'swift-test-target' || file.path.split('/').at(-1) === 'Package.swift'),
            );
        }
        files.push(file);
    }
    return {
        root,
        attributes,
        index,
        hasGit,
        files,
        scopes: [
            { ...ROOT_SCOPE, configurations: [] },
            ...scopeEntries
                .filter((entry) => directory.stat(entry.path)?.isDirectory() === true)
                .map((entry) =>
                    buildScope({
                        path: entry.path,
                        configurations: entry.configurations,
                        source: POLICY_FILE,
                    }),
                ),
        ],
    };
}

/**
 * Whether a path is a Vale package file: under the styles folder and not the gspot style or accepted-word files.
 * @param path the file, relative to the root
 * @returns true for a package file
 */
export function isValePackageFile(path: string): boolean {
    return path.startsWith(`${STYLES_DIRECTORY}/`) && VALE_OWN_PREFIXES.every((prefix) => !path.startsWith(prefix));
}

/**
 * Classify from declarations, attributes, binary content, managed paths, banners, then vendored directories.
 * @param file the source entry, its captured bytes, and repository location
 * @param rules the generated and vendored declarations and captured Git attributes
 * @returns the kind and where it came from
 */
export function kindOf(file: FileClassification, rules: FileClassificationRules): Verdict {
    const { root, entry, isBinary, prefix } = file;
    const { path } = entry;
    const declared = declaredKind(path, rules);
    if (declared) return declared;
    // Explicit text attributes override binary content and extension hints.
    if (isBinary && rules.attributes.get(path)?.['text'] !== 'set') return { kind: 'binary', source: 'content' };
    if (isLicenseFile(path)) return { kind: 'vendored', source: 'license' };
    const managed = classifyToolFile(path, prefix);
    if (managed) return managed;
    if (
        path
            .split('/')
            .slice(0, -1)
            .some((segment) => VENDORED_DIRECTORIES.includes(segment))
    )
        return { kind: 'vendored', source: 'directory' };
    return sourceKind(root, entry, prefix);
}

/**
 * Reads attribute rules once for a repository read.
 * @param root the repository root
 * @param paths the tracked attribute-file paths
 * @param hasGit whether Git can evaluate repository and user attribute precedence
 * @returns the parsed rules, or none when the optional file is absent
 */
export function readAttributes(root: string, paths: string[], hasGit: boolean): Map<string, Record<string, string>> {
    if (paths.length === 0) return new Map();
    if (hasGit) {
        const result = runGitBlocking(
            root,
            ['check-attr', '--stdin', '-z', 'linguist-generated', 'linguist-vendored', 'text', 'filter'],
            {
                stdin: paths.join('\0') + '\0',
            },
        );
        if (result.code !== 0) throw new Error(`Git attribute resolution failed: ${result.stderr.trim()}`);
        return gitAttributes(result.stdout);
    }
    const files = [
        ...new Set(['.gitattributes', ...paths.filter((path) => posix.basename(path) === '.gitattributes')]),
    ];
    const declarations = files
        .toSorted((left, right) => left.split('/').length - right.split('/').length)
        .flatMap((path) => {
            const text = readText(root, path);
            return text === undefined ? [] : attributeRules(text, posix.dirname(path));
        });
    const rules = declarations.map((entry) => ({
        matcher: pathMatcher([entry.pattern]),
        attributes: entry.attributes,
    }));
    const attributes = new Map<string, Record<string, string>>();
    for (const path of paths) {
        let effective: Record<string, string> = {};
        for (const rule of rules.filter((entry) => entry.matcher(path)))
            effective = resolvedAttributes(rule.attributes, effective);
        attributes.set(path, effective);
    }
    return attributes;
}

/**
 * Identify environment files that contain machine values rather than templates.
 * @param path the repository-relative path.
 * @returns whether the file contains environment values.
 */
export function isEnvironmentFile(path: string): boolean {
    return matchesEnvironmentFile(path) && !ENV_TEMPLATE_NAMES.includes(posix.basename(path));
}
