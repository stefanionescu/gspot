// Every tracked path has one nature: source, generated, vendored, binary.
import { join } from 'node:path';
import { head } from '#cli/repository/tracked.ts';
import { existsSync, readFileSync } from 'node:fs';
import type { DeclareEntry } from '#types/config.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import type { Attribute, NatureVerdict } from '#types/repository.ts';

import {
    GENERATED_BANNERS,
    INSTALLED_PREFIXES,
    LICENSE_FILE,
    VALE_OWN_PREFIXES,
    VALE_STYLES_PREFIX,
    VENDORED_DIRECTORIES,
} from '#config/patterns.ts';

const BANNER_BYTES = 1024;

const GENERATED_ATTRIBUTES = new Set(['linguist-generated', 'linguist-generated=true']);

const VENDORED_ATTRIBUTES = new Set(['linguist-vendored', 'linguist-vendored=true']);

const BINARY_ATTRIBUTES = new Set(['-text', 'binary']);

const state: { attributes: { root: string; rules: Attribute[] } | undefined } = { attributes: undefined };

function attributeRule(line: string): Attribute | undefined {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return undefined;
    const [pattern = '', ...attributes] = trimmed.split(/\s+/u);
    if (pattern === '') return undefined;
    const bare = pattern.startsWith('/') ? pattern.slice(1) : pattern;
    return { matcher: pathMatcher([pattern.includes('/') ? bare : `**/${pattern}`]), attributes };
}

function parseGitattributes(root: string): Attribute[] {
    const path = join(root, '.gitattributes');
    if (!existsSync(path)) return [];
    return readFileSync(path, 'utf8')
        .split('\n')
        .map((line) => attributeRule(line))
        .filter((rule) => rule !== undefined);
}

function attributesFor(root: string, path: string): string[] {
    if (state.attributes?.root !== root) state.attributes = { root, rules: parseGitattributes(root) };
    return state.attributes.rules.filter((rule) => rule.matcher(path)).flatMap((rule) => rule.attributes);
}

function declaredNature(path: string, declares: DeclareEntry[]): NatureVerdict | undefined {
    for (const entry of declares) {
        if (!pathMatcher(entry.paths)(path)) continue;
        if (entry.produced_by !== undefined)
            return { nature: 'generated', source: 'declare', producedBy: entry.produced_by };
        if (entry.vendored === true) return { nature: 'vendored', source: 'declare' };
    }
    return undefined;
}

function attributeNature(attributes: string[]): NatureVerdict | undefined {
    if (attributes.some((attribute) => GENERATED_ATTRIBUTES.has(attribute)))
        return { nature: 'generated', source: '.gitattributes' };
    if (attributes.some((attribute) => VENDORED_ATTRIBUTES.has(attribute)))
        return { nature: 'vendored', source: '.gitattributes' };
    const isBinary = attributes.some(
        (attribute) => BINARY_ATTRIBUTES.has(attribute) || attribute.startsWith('filter=lfs'),
    );
    return isBinary ? { nature: 'binary', source: '.gitattributes' } : undefined;
}

function hasBanner(root: string, path: string): boolean {
    const start = head(root, path, BANNER_BYTES);
    return GENERATED_BANNERS.some((banner) => banner.test(start));
}

function managedNature(path: string): NatureVerdict | undefined {
    if (LICENSE_FILE.test(path.slice(path.lastIndexOf('/') + 1))) return { nature: 'vendored', source: 'license' };
    if (INSTALLED_PREFIXES.some((prefix) => path.startsWith(prefix))) return { nature: 'generated', source: 'gspot' };
    if (isValePackageFile(path)) return { nature: 'vendored', source: 'gspot' };
    return undefined;
}

function isUnderVendoredDirectory(path: string): boolean {
    return path
        .split('/')
        .slice(0, -1)
        .some((segment) => VENDORED_DIRECTORIES.includes(segment));
}

/**
 * Whether git stores the file through LFS, by its attributes.
 * @param root the repository root
 * @param path the file, relative to the root
 * @returns true under an lfs filter
 */
export function isUnderLfs(root: string, path: string): boolean {
    return attributesFor(root, path).some((attribute) => attribute.startsWith('filter=lfs'));
}

/**
 * Whether a path is a Vale package file: under the styles folder and not the gspot style or vocabulary.
 * @param path the file, relative to the root
 * @returns true for a package file
 */
export function isValePackageFile(path: string): boolean {
    return path.startsWith(VALE_STYLES_PREFIX) && VALE_OWN_PREFIXES.every((prefix) => !path.startsWith(prefix));
}

/**
 * Decides the nature of one path in the order the design fixes: declarations, .gitattributes, the gspot installs, banners, vendored directories, the binary sniff.
 * @param root the repository root
 * @param path the file, relative to the root
 * @param declares the [[declare]] entries
 * @param isBinary whether the content sniff found binary bytes
 * @param isText whether the file is text that can carry a banner
 * @returns the nature and where it came from
 */
export function natureOf(
    root: string,
    path: string,
    declares: DeclareEntry[],
    isBinary: boolean,
    isText: boolean,
): NatureVerdict {
    const declared = declaredNature(path, declares) ?? attributeNature(attributesFor(root, path));
    if (declared) return declared;
    if (isBinary) return { nature: 'binary', source: 'content' };
    const managed = managedNature(path);
    if (managed) return managed;
    if (isText && hasBanner(root, path)) return { nature: 'generated', source: 'banner' };
    if (isUnderVendoredDirectory(path)) return { nature: 'vendored', source: 'directory' };
    return { nature: 'source', source: 'default' };
}

/** Drops the .gitattributes cache; tests use it after planting a file. */
export function resetNatures(): void {
    state.attributes = undefined;
}
