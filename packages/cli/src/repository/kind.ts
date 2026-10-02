// Every tracked path has one kind: source, generated, vendored, binary.
import { baseName } from '#cli/platform/paths.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Verdict, Attribute, FileDeclaration } from '#cli/types/repository/repository.ts';

import {
    BANNER_BYTES,
    GSPOT_FOLDER,
    LICENSE_FILE,
    BINARY_ATTRIBUTES,
    ENV_FILE_PATTERNS,
    GENERATED_BANNERS,
    VALE_OWN_PREFIXES,
    ENV_TEMPLATE_NAMES,
    VALE_STYLES_PREFIX,
    VENDORED_ATTRIBUTES,
    GENERATED_ATTRIBUTES,
    VENDORED_DIRECTORIES,
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

function declaredKind(path: string, declarations: FileDeclaration[]): Verdict | undefined {
    for (const entry of declarations) {
        if (!pathMatcher(entry.paths)(path)) continue;
        return {
            kind: entry.kind,
            source: entry.kind,
            ...(entry.kind === 'generated' && entry.produced_by !== undefined ? { producedBy: entry.produced_by } : {}),
        };
    }
    return undefined;
}

function attributeKind(attributes: string[]): Verdict | undefined {
    if (attributes.some((attribute) => GENERATED_ATTRIBUTES.has(attribute)))
        return { kind: 'generated', source: '.gitattributes' };
    if (attributes.some((attribute) => VENDORED_ATTRIBUTES.has(attribute)))
        return { kind: 'vendored', source: '.gitattributes' };
    const isBinary = attributes.some(
        (attribute) => BINARY_ATTRIBUTES.has(attribute) || attribute.startsWith('filter=lfs'),
    );
    return isBinary ? { kind: 'binary', source: '.gitattributes' } : undefined;
}

// gspot writes everything under its folder; the Vale packages it fetches there are another party's text.
function managedKind(path: string): Verdict | undefined {
    if (LICENSE_FILE.test(baseName(path))) return { kind: 'vendored', source: 'license' };
    if (isValePackageFile(path)) return { kind: 'vendored', source: 'gspot' };
    return path.startsWith(`${GSPOT_FOLDER}/`) ? { kind: 'generated', source: 'gspot' } : undefined;
}

/**
 * Whether a path is a Vale package file: under the styles folder and not the gspot style or vocabulary.
 * @param path the file, relative to the root
 * @returns true for a package file
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Apply, drift, file kinds, and dependencies tell Vale package files from the gspot style by this one rule.
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
 * @returns the kind and where it came from.
 */
export function kindOf(
    path: string,
    declarations: FileDeclaration[],
    isBinary: boolean,
    prefix: Buffer,
    attributes: Attribute[],
): Verdict {
    const matched = attributes.filter((rule) => rule.matcher(path)).flatMap((rule) => rule.attributes);
    const declared = declaredKind(path, declarations) ?? attributeKind(matched);
    if (declared) return declared;
    if (isBinary) return { kind: 'binary', source: 'content' };
    const managed = managedKind(path);
    if (managed) return managed;
    const start = prefix.subarray(0, BANNER_BYTES).toString('utf8');
    if (GENERATED_BANNERS.some((banner) => banner.test(start))) return { kind: 'generated', source: 'banner' };
    if (
        path
            .split('/')
            .slice(0, -1)
            .some((segment) => VENDORED_DIRECTORIES.includes(segment))
    )
        return { kind: 'vendored', source: 'directory' };
    return { kind: 'source', source: 'default' };
}

/**
 * Reads attribute rules once for a repository read.
 * @param root the repository root
 * @returns the parsed rules, or none when the optional file is absent
 */
export function readAttributes(root: string): Attribute[] {
    using files = openRoot(root);
    return (files.read('.gitattributes')?.bytes.toString('utf8') ?? '')
        .split('\n')
        .map((line) => attributeRule(line))
        .filter((rule) => rule !== undefined);
}

// What is in the tree: files, kinds, tags, scopes, and the tooling init finds.

/**
 * Identify environment files that contain machine values rather than templates.
 * @param path the repository-relative path.
 * @returns whether the file contains environment values.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The env check and the staged selection find machine environment files by this one rule.
export function isEnvironmentFile(path: string): boolean {
    return matchesEnvironmentFile(path) && !ENV_TEMPLATE_NAMES.includes(baseName(path));
}
