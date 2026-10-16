import picomatch from 'picomatch';
import type { Session } from '#cli/types/planning.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { readLinguistPatterns } from '#cli/repository/read.ts';
import { listFileDeclarations } from '#cli/repository/classify.ts';
import { PRETTIERIGNORE_HEADER } from '#cli/config/generation/formatting.ts';
import { type ScopeView, type ScopeSelection } from '#cli/types/settings/values.ts';
import { BRACE_TOKENS, ALWAYS_IGNORED } from '#cli/config/generation/ignore-patterns.ts';

// Expand alternatives before splitting paths because a brace branch can contain a directory separator.
function expandAlternatives(pattern: string): string[] {
    let braceStart = -1;
    let depth = 0;
    const branches: string[] = [];
    let branchStart = 0;
    // Keep escaped characters and character classes out of the brace parser.
    const tokens = pattern.matchAll(BRACE_TOKENS);
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

function moveIntoScope(pattern: string, scope: string): string[] {
    const isFolderPattern = pattern.endsWith('/');
    const bare = isFolderPattern ? pattern.slice(0, -1) : pattern;
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
    return [...states].map((index) => `/${parts.slice(index).join('/')}${isFolderPattern ? '/' : ''}`);
}

/**
 * Preserve ordered gitignore patterns when discovery moves their base into a scope directory.
 *
 * @param patterns the gitignore patterns, relative to the root.
 * @param scope the scope path the tool discovers from.
 *
 * @returns the patterns relative to the scope.
 */
export function moveIgnorePatterns(patterns: string[], scope: string): string[] {
    if (scope === '') return patterns;
    return patterns.flatMap((pattern) => {
        if (pattern === '' || pattern.startsWith('#')) return [];
        const isNegated = pattern.startsWith('!');
        const bare = isNegated ? pattern.slice(1) : pattern;
        const rebased = expandAlternatives(bare).flatMap((entry) => moveIntoScope(entry, scope));
        return [...new Set(rebased)].map((entry) => `${isNegated ? '!' : ''}${entry}`);
    });
}

/**
 * Tool projects, selected generated outputs, and Git attribute selectors excluded by tools.
 *
 * @param session the repository inventory and selected configurations.
 *
 * @returns unique repository-relative patterns.
 */
export function generatedIgnores(session: Pick<Session, 'reads' | 'repository' | 'scopes'>): string[] {
    const { reads, repository, scopes } = session;
    const declarations = listFileDeclarations(new Map(scopes.map(({ scope, selected }) => [scope.path, selected])));
    const tracked = repository.index.length === 0 ? repository.files : repository.index;
    return [
        ...new Set([
            ...ALWAYS_IGNORED,
            ...scopes.flatMap(({ selected }) =>
                selected.flatMap(({ ignored_folders: ignoredFolders }) =>
                    ignoredFolders.map((folder) => `**/${folder}/**`),
                ),
            ),
            ...readLinguistPatterns(
                reads,
                tracked.map(({ path }) => path),
            ),
            ...declarations.flatMap(({ paths }) => paths),
        ]),
    ];
}

/**
 * The selected language folders and lockfiles excluded by repository-wide tools.
 *
 * @param scopes the actual selected manifests and their scope origins.
 *
 * @returns unique repository-relative ignore paths.
 */
export function selectedIgnorePaths(scopes: ScopeSelection[]): string[] {
    const names = new Set(scopes.flatMap(({ selected }) => selected.map(({ configuration }) => configuration.name)));
    return [
        ...new Set([
            ...scopes.flatMap(({ selected }) =>
                selected.flatMap(({ ignored_folders: ignoredFolders }) => ignoredFolders.map((path) => `${path}/`)),
            ),
            ...LOCKFILES.filter((lockfile) => 'configuration' in lockfile && names.has(lockfile.configuration)).map(
                ({ file }) => file,
            ),
        ]),
    ];
}

/**
 * The selected Git-ignore paths without duplicate glob forms of ignored folders.
 *
 * @param session the repository session.
 *
 * @returns the ordered generated ignore patterns.
 */
export function gitignorePatterns(session: Pick<Session, 'reads' | 'repository' | 'scopes'>): string[] {
    const paths = selectedIgnorePaths(session.scopes);
    const folders = new Set(paths.filter((path) => path.endsWith('/')).map((path) => `**/${path.slice(0, -1)}/**`));
    return [...new Set([...generatedIgnores(session).filter((pattern) => !folders.has(pattern)), ...paths])];
}

/**
 * Write the prettierignore configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.ignoresFor the check path-ignore reader.
 * @param root0.ignoredPaths the generated ignore path patterns.
 *
 * @returns the generated configuration text.
 */
export function buildPrettierignore({
    ignoresFor,
    ignoredPaths,
}: Pick<ScopeView, 'ignoresFor'> & { ignoredPaths: string[] }): string {
    return (
        [
            PRETTIERIGNORE_HEADER,
            ...ignoredPaths,
            ...ignoresFor('format/prettier')
                .filter(({ rule }) => rule === undefined)
                .flatMap(({ paths }) => paths),
        ].join('\n') + '\n'
    );
}
