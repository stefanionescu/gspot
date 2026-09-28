// Every tracked path has one nature: source, generated, vendored, binary.
import { openRoot } from '#cli/platform/filesystem.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import type { FileDeclaration } from '#cli/types/policy/policy.ts';
import type { Attribute, NatureVerdict } from '#cli/types/repository/repository.ts';

import {
    LICENSE_FILE,
    GENERATED_BANNERS,
    VALE_OWN_PREFIXES,
    INSTALLED_PREFIXES,
    VALE_STYLES_PREFIX,
    VENDORED_DIRECTORIES,
} from '#cli/config/repository/patterns.ts';
import {
    BANNER_BYTES,
    BINARY_ATTRIBUTES,
    ENV_FILE_PATTERNS,
    ENV_TEMPLATE_NAMES,
    VENDORED_ATTRIBUTES,
    GENERATED_ATTRIBUTES,
} from '#cli/config/repository/repository.ts';

const matchesEnvironmentFile = pathMatcher(ENV_FILE_PATTERNS.map((pattern) => `**/${pattern}`));

function attributeRule(line: string): Attribute | undefined {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return undefined;
    const [pattern = '', ...attributes] = trimmed.split(/\s+/u);
    if (pattern === '') return undefined;
    const bare = pattern.startsWith('/') ? pattern.slice(1) : pattern;
    return { matcher: pathMatcher([pattern.includes('/') ? bare : `**/${pattern}`]), attributes };
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

function managedNature(path: string): NatureVerdict | undefined {
    if (LICENSE_FILE.test(path.slice(path.lastIndexOf('/') + 1))) return { nature: 'vendored', source: 'license' };
    if (INSTALLED_PREFIXES.some((prefix) => path.startsWith(prefix))) return { nature: 'generated', source: 'gspot' };
    if (isValePackageFile(path)) return { nature: 'vendored', source: 'gspot' };
    return undefined;
}

/**
 * Whether a path is a Vale package file: under the styles folder and not the gspot style or vocabulary.
 * @param path the file, relative to the root
 * @returns true for a package file
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Whether a path is a Vale package file: under the styles folder and not the gspot style or vocabulary. 4 files make 7 calls; one owner keeps that behavior in one place.
export function isValePackageFile(path: string): boolean {
    return path.startsWith(VALE_STYLES_PREFIX) && VALE_OWN_PREFIXES.every((prefix) => !path.startsWith(prefix));
}

/**
 * Classify from declarations, attributes, binary content, managed paths, banners, then vendored directories.
 * @param path the file, relative to the root.
 * @param declarations the generated and vendored declarations.
 * @param isBinary whether the content sniff found binary bytes.
 * @param prefix the captured first bytes.
 * @param attributes the captured attribute rules.
 * @returns the nature and where it came from.
 */
export function natureOf(
    path: string,
    declarations: FileDeclaration[],
    isBinary: boolean,
    prefix: Buffer,
    attributes: Attribute[],
): NatureVerdict {
    const matched = attributes.filter((rule) => rule.matcher(path)).flatMap((rule) => rule.attributes);
    const declared = declaredNature(path, declarations) ?? attributeNature(matched);
    if (declared) return declared;
    if (isBinary) return { nature: 'binary', source: 'content' };
    const managed = managedNature(path);
    if (managed) return managed;
    const start = prefix.subarray(0, BANNER_BYTES).toString('utf8');
    if (GENERATED_BANNERS.some((banner) => banner.test(start))) return { nature: 'generated', source: 'banner' };
    if (
        path
            .split('/')
            .slice(0, -1)
            .some((segment) => VENDORED_DIRECTORIES.includes(segment))
    )
        return { nature: 'vendored', source: 'directory' };
    return { nature: 'source', source: 'default' };
}

/**
 * Reads attribute rules once for a repository observation.
 * @param root the repository root
 * @returns the parsed rules, or none when the optional file is absent
 */
export function readAttributes(root: string): Attribute[] {
    const files = openRoot(root);
    try {
        return (files.read('.gitattributes')?.bytes.toString('utf8') ?? '')
            .split('\n')
            .map((line) => attributeRule(line))
            .filter((rule) => rule !== undefined);
    } finally {
        files.close();
    }
}

// What is in the tree: files, natures, tags, scopes, and the tooling init finds.

/**
 * Identify environment files that contain machine values rather than templates.
 * @param path the repository-relative path.
 * @returns whether the file contains environment values.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Identify environment files that contain machine values rather than templates. 2 files make 0 calls; one owner keeps that behavior in one place.
export function isEnvironmentFile(path: string): boolean {
    return matchesEnvironmentFile(path) && !ENV_TEMPLATE_NAMES.includes(path.slice(path.lastIndexOf('/') + 1));
}
