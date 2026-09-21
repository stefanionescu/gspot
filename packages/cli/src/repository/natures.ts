// Every tracked path has one nature: source, generated, vendored, binary.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { FileDeclaration } from '#types/config.ts';
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

function attributeRule(line: string): Attribute | undefined {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return undefined;
    const [pattern = '', ...attributes] = trimmed.split(/\s+/u);
    if (pattern === '') return undefined;
    const bare = pattern.startsWith('/') ? pattern.slice(1) : pattern;
    return { matcher: pathMatcher([pattern.includes('/') ? bare : `**/${pattern}`]), attributes };
}

function attributesFor(rules: Attribute[], path: string): string[] {
    return rules.filter((rule) => rule.matcher(path)).flatMap((rule) => rule.attributes);
}

function declaredNature(path: string, declarations: FileDeclaration[]): NatureVerdict | undefined {
    for (const entry of declarations) {
        if (!pathMatcher(entry.paths)(path)) continue;
        return {
            nature: entry.nature,
            source: entry.nature,
            ...(entry.nature === 'generated' && entry.produced_by !== undefined
                ? { producedBy: entry.produced_by }
                : {}),
        };
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

function hasBanner(prefix: Buffer): boolean {
    const start = prefix.subarray(0, BANNER_BYTES).toString('utf8');
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
 * @param attributes the captured attribute rules
 * @param path the file, relative to the root
 * @returns true under an lfs filter
 */
export function isUnderLfs(attributes: Attribute[], path: string): boolean {
    return attributesFor(attributes, path).some((attribute) => attribute.startsWith('filter=lfs'));
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
 * @param path the file, relative to the root
 * @param declarations the generated and vendored declarations
 * @param isBinary whether the content sniff found binary bytes
 * @param prefix the captured first bytes
 * @param attributes the captured attribute rules
 * @returns the nature and where it came from
 */
export function natureOf(
    path: string,
    declarations: FileDeclaration[],
    isBinary: boolean,
    prefix: Buffer,
    attributes: Attribute[],
): NatureVerdict {
    const declared = declaredNature(path, declarations) ?? attributeNature(attributesFor(attributes, path));
    if (declared) return declared;
    if (isBinary) return { nature: 'binary', source: 'content' };
    const managed = managedNature(path);
    if (managed) return managed;
    if (hasBanner(prefix)) return { nature: 'generated', source: 'banner' };
    if (isUnderVendoredDirectory(path)) return { nature: 'vendored', source: 'directory' };
    return { nature: 'source', source: 'default' };
}

/**
 * Reads attribute rules once for a repository observation.
 * @param root the repository root
 * @returns the parsed rules, or none when the optional file is absent
 */
export function readAttributes(root: string): Attribute[] {
    let text: string;
    try {
        text = readFileSync(join(root, '.gitattributes'), 'utf8');
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
        throw error;
    }
    return text
        .split('\n')
        .map((line) => attributeRule(line))
        .filter((rule) => rule !== undefined);
}
