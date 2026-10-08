import picomatch from 'picomatch';
import { dirname, relative } from 'node:path';
import { parseJsonRecord } from '#cli/parsers/public.ts';
import { jsonText } from '#cli/generation/json-format.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { toPosix, extensionOf } from '#cli/platform/contracts.ts';
import type { CapturedRules } from '#cli/types/generation/rules.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { JsonFormat } from '#cli/types/generation/formatting.ts';
import { ruleSettingsSchema } from '#cli/parsers/schema/tool-rule.ts';
import type { ToolFileDeclaration } from '#cli/types/configurations.ts';
import { TARGET_PLACEHOLDER } from '#cli/config/generation/pointers.ts';
import { GENERATED_JSON_KEY } from '#cli/config/parsers/generated-header.ts';

import {
    HTML_EXTENSIONS,
    JSON_EXTENSIONS,
    GENERATED_HEADER_LINES,
    SLASH_COMMENT_EXTENSIONS,
} from '#cli/config/generation/headers.ts';

// Expand alternatives before splitting paths because a brace branch can contain a directory separator.
function expandAlternatives(pattern: string): string[] {
    let braceStart = -1;
    let depth = 0;
    const branches: string[] = [];
    let branchStart = 0;
    // Keep escaped characters and character classes out of the brace parser.
    const tokens = pattern.matchAll(/\\[\s\S]|\[(?:\\[\s\S]|[^\]\\])*\]?|[{},]/gu);
    const closing = [...tokens].find((match) => {
        const [character] = match;
        const position = match.index;
        switch (character) {
            case '{': {
                if (depth === 0) {
                    braceStart = position;
                    branchStart = position + 1;
                }
                depth += 1;
                break;
            }
            case ',': {
                if (depth === 1) {
                    branches.push(pattern.slice(branchStart, position));
                    branchStart = position + 1;
                }
                break;
            }
            case '}': {
                if (depth !== 1) {
                    depth = Math.max(0, depth - 1);
                    break;
                }
                branches.push(pattern.slice(branchStart, position));
                return true;
            }
        }
        return false;
    });
    if (closing === undefined) return [pattern];
    return branches.flatMap((entry) =>
        expandAlternatives(`${pattern.slice(0, braceStart)}${entry}${pattern.slice(closing.index + 1)}`),
    );
}

// A globstar can consume no directories or stay active while consuming the scope prefix.
function expandGlobstarSkips(states: Set<number>, parts: string[]): Set<number> {
    const expanded = new Set(states);
    for (const index of expanded) if (parts[index] === '**') expanded.add(index + 1);
    return expanded;
}

function rebaseOntoScope(pattern: string, scope: string): string[] {
    const isDirectoryPattern = pattern.endsWith('/');
    const bare = isDirectoryPattern ? pattern.slice(0, -1) : pattern;
    const isAnchored = bare.startsWith('/') || bare.includes('/');
    const parts = bare.replace(/^\//u, '').split('/');
    if (!isAnchored) parts.unshift('**');
    let states = expandGlobstarSkips(new Set([0]), parts);
    for (const name of scope.split('/')) {
        const next = [...states].flatMap((index) => {
            const part = parts[index];
            if (part === undefined || part === '**') return [index];
            return picomatch.isMatch(name, part, { dot: true, noext: true, nonegate: true }) ? [index + 1] : [];
        });
        states = expandGlobstarSkips(new Set(next), parts);
    }
    if (states.has(parts.length)) return ['/**'];
    return [...states].map((index) => `/${parts.slice(index).join('/')}${isDirectoryPattern ? '/' : ''}`);
}

function commented(lines: string[], mark: string): string {
    const marked = lines.map((line) => `${mark} ${line}`).join('\n');
    return `${marked}\n`;
}

/**
 * The header lines for a version.
 * @param version the gspot version
 * @returns the header lines
 */
function headerLines(version: string): string[] {
    return GENERATED_HEADER_LINES.map((line) => line.replaceAll('{{version}}', () => version));
}

// The string id of a rule record, or an error naming the path that holds something else.
function ruleId(entry: unknown, path: string): string {
    const id: unknown = typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'id') : undefined;
    if (typeof id !== 'string') throw new Error(`Rule path ${path} must contain records with string IDs.`);
    return id;
}

// The value at a dotted path inside parsed configuration, or undefined once a segment is absent.
function getTable(parsed: unknown, segments: string[], path: string): unknown {
    let value: unknown = parsed;
    for (const part of segments) {
        if (value === undefined) break;
        if (typeof value !== 'object' || value === null) throw new Error(`Rule path ${path} is not a table.`);
        value = Reflect.get(value, part);
    }
    return value;
}

function mapRules(value: unknown[], path: string): Map<string, unknown> {
    if (value.every((entry) => typeof entry === 'string')) return new Map(value.map((rule: string) => [rule, true]));
    const rules = new Map<string, unknown>();
    for (const entry of value) {
        const id = ruleId(entry, path);
        if (rules.has(id)) throw new Error(`Rule path ${path} contains duplicate ID ${id}.`);
        rules.set(id, entry);
    }
    return rules;
}

function getRules(parsed: unknown, path: string): Map<string, unknown> {
    const segments = path === '' ? [] : path.split('.');
    const value = getTable(parsed, segments, path);
    if (value === undefined || value === null) return new Map();
    if (Array.isArray(value)) return mapRules(value, path);
    if (typeof value === 'object') return new Map(Object.entries(value));
    throw new Error(`Rule path ${path} must contain a rule list or table.`);
}

/**
 * Preserve ordered gitignore patterns when native discovery moves their base into a scope directory.
 * @param patterns the gitignore patterns, relative to the root
 * @param scope the scope path the tool discovers from
 * @returns the patterns relative to the scope
 */
export function scopeIgnorePatterns(patterns: string[], scope: string): string[] {
    if (scope === '') return patterns;
    return patterns.flatMap((pattern) => {
        if (pattern === '' || pattern.startsWith('#')) return [];
        const isNegated = pattern.startsWith('!');
        const bare = isNegated ? pattern.slice(1) : pattern;
        const rebased = expandAlternatives(bare).flatMap((entry) => rebaseOntoScope(entry, scope));
        return [...new Set(rebased)].map((entry) => `${isNegated ? '!' : ''}${entry}`);
    });
}

/**
 * The tool project folders and declared outputs excluded from generated code configurations.
 * @param declarationPaths authored generated and vendored paths
 * @param exclusions additional exclusions of the native configuration
 * @returns ordered repository-relative patterns
 */
export function generatedIgnores(declarationPaths: string[], exclusions: string[]): string[] {
    return ['**/node_modules/**', `${DOT_GSPOT}/**`, ...exclusions, ...declarationPaths];
}

/**
 * The selected language folders and native lockfiles excluded by repository-wide tools.
 * @param scopes the actual selected manifests and their scope origins
 * @returns unique repository-relative ignore paths
 */
export function selectedIgnorePaths(scopes: ScopeSelection[]): string[] {
    return [
        ...new Set(
            scopes.flatMap(({ scope, selected }) => {
                const names = new Set(selected.map((manifest) => manifest.configuration.name));
                const paths = [
                    ...selected.flatMap((manifest) => manifest.ignored_folders),
                    ...LOCKFILES.filter(
                        (lockfile) => 'configuration' in lockfile && names.has(lockfile.configuration),
                    ).map(({ file }) => file),
                ];
                return paths.map((path) => (scope.path === '' ? path : `${scope.path}/${path}`));
            }),
        ),
    ];
}

/**
 * The generated notice as comments beginning with `#`.
 * @param version the gspot version
 * @returns the comment block ending in a newline
 */
export function hashCommentHeader(version: string): string {
    return commented(headerLines(version), '#');
}

/**
 * The header as a comment for a target path, or '' for JSON, which carries it as a key.
 * @param path the target path
 * @param version the gspot version
 * @returns the comment block ending in a newline, or ''
 */
export function headerFor(path: string, version: string): string {
    const extension = extensionOf(path);
    if (JSON_EXTENSIONS.has(extension)) return '';
    if (SLASH_COMMENT_EXTENSIONS.has(extension)) return commented(headerLines(version), '//');
    if (HTML_EXTENSIONS.has(extension)) {
        const indented = headerLines(version)
            .map((line) => `  ${line}`)
            .join('\n');
        return `<!--\n${indented}\n-->\n`;
    }
    if (extension === '.sql') return commented(headerLines(version), '--');
    return hashCommentHeader(version);
}

/**
 * Puts the header into emitted JSON as the first key, formatted the way the repository's Prettier settings format it.
 * @param emitted the emitted JSON text
 * @param version the gspot version
 * @param format the print width and indent width
 * @returns the JSON text with the header key first
 */
export function addJsonHeader(emitted: string, version: string, format: JsonFormat): string {
    const parsed = parseJsonRecord(emitted);
    const ordered: Record<string, unknown> = { [GENERATED_JSON_KEY]: headerLines(version).join(' ') };
    for (const [key, value] of Object.entries(parsed)) if (key !== GENERATED_JSON_KEY) ordered[key] = value;
    return jsonText(ordered, format);
}

/**
 * Resolve target placeholders in native pointer text.
 * @param value the body text or rendered Eta source
 * @param pointerPath the native pointer file
 * @param targetPath the generated tool file
 * @returns the native text with quoted module and JSON paths preserved
 */
export function fillTarget(value: string, pointerPath: string, targetPath: string): string {
    const target = relativeTarget(pointerPath, targetPath);
    return value.replaceAll(TARGET_PLACEHOLDER, (placeholder) => {
        if (placeholder === '{target_module}') {
            return JSON.stringify(
                target
                    .split('/')
                    .map((segment) => encodeURIComponent(segment))
                    .join('/'),
            );
        }
        return placeholder === '{target_json}' ? JSON.stringify(target) : target;
    });
}

/**
 * Names a generated target relative to its native pointer, including the local-module prefix.
 * @param pointerPath the authored pointer file
 * @param targetPath the generated target file
 * @returns a portable relative path understood by native configuration loaders
 */
export function relativeTarget(pointerPath: string, targetPath: string): string {
    const relativePath = toPosix(relative(dirname(pointerPath), targetPath));
    return relativePath.startsWith('./') || relativePath.startsWith('../') ? relativePath : `./${relativePath}`;
}

/**
 * Emits a body pointer: the body with the target placeholder replaced, under the header.
 * @param pointer the pointer declaration
 * @param pointerPath the pointer's path
 * @param targetPath the generated file's path
 * @param version the gspot version
 * @returns the generated file
 */
export function bodyPointer(
    pointer: NonNullable<ToolFileDeclaration['pointer']>,
    pointerPath: string,
    targetPath: string,
    version: string,
): GeneratedFile {
    const body = fillTarget(pointer.body ?? '', pointerPath, targetPath);
    const ended = body.endsWith('\n') ? body : `${body}\n`;
    return {
        path: pointerPath,
        content: `${headerFor(pointerPath, version)}${ended}`,
        kind: 'pointer',
    };
}

/**
 * Collect rule tables from generation data before the tool's serializer runs.
 * @param paths manifest paths naming rule tables or lists
 * @param document the configuration data being generated
 * @returns comparable JSON rule values, grouped by their manifest paths
 */
export function collectRules(paths: string[], document: unknown): CapturedRules {
    return ruleSettingsSchema.parse(
        Object.fromEntries(paths.map((path) => [path, Object.fromEntries(getRules(document, path))])),
    );
}
