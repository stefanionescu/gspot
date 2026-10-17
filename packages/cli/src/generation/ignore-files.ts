// Build shared ignore sections and project their patterns into each scope.
import picomatch from 'picomatch';
import { dirname, basename } from 'node:path/posix';
import { joinScope } from '#cli/repository/scopes.ts';
import type { Session } from '#cli/types/planning.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { listPointerPaths } from '#cli/generation/pointers.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { readLinguistPatterns } from '#cli/repository/read.ts';
import { type ScopeView } from '#cli/types/settings/values.ts';
import { IGNORE_FILE_PURPOSES } from '#cli/config/generation/formatting.ts';
import { isInGspotFolder, listFileDeclarations } from '#cli/repository/classify.ts';
import { type IgnoreSection, type ToolFileContext } from '#cli/types/generation/files.ts';

import {
    BRACE_TOKENS,
    BUILD_OUTPUT_FOLDERS,
    GSPOT_FOLDER_PATTERNS,
    IGNORE_SECTION_TITLES,
    BUILD_OUTPUT_PATTERNS,
    LOCAL_ENVIRONMENT_PATTERNS,
} from '#cli/config/generation/ignore-files.ts';

// Expand alternatives before splitting paths, because a brace branch can hold a slash.
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

// A globstar can match no folders, or stay active while it matches the scope prefix.
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
 * Move gitignore patterns into a scope folder, and keep their order.
 *
 * @param patterns the gitignore lines, relative to the root.
 * @param scope the folder where the tool starts.
 *
 * @returns the patterns relative to the scope.
 */
function moveIgnorePatterns(patterns: string[], scope: string): string[] {
    if (scope === '') return patterns;
    return patterns.flatMap((pattern) => {
        if (pattern === '' || pattern.startsWith('#')) return [];
        const isNegated = pattern.startsWith('!');
        const bare = isNegated ? pattern.slice(1) : pattern;
        const rebased = expandAlternatives(bare).flatMap((entry) => moveIntoScope(entry, scope));
        return [...new Set(rebased)].map((entry) => `${isNegated ? '!' : ''}${entry}`);
    });
}

// Collect the generated destinations and pointers that external scanners must leave alone.
function collectToolExclusions(session: Parameters<typeof buildIgnoreSections>[0]): string[] {
    const { repository, scopes } = session;
    const needed = new Set(session.neededToolManifests.map((manifest) => manifest.configuration.name));
    return scopes.flatMap((selection) =>
        selection.selected
            .filter((manifest) => needed.has(manifest.configuration.name))
            .flatMap((manifest) =>
                manifest.toolFiles.flatMap((file) => [
                    ...(!file.fragment && !isInGspotFolder(file.target)
                        ? [file.per_scope ? joinScope(selection.scope.path, file.target) : file.target]
                        : []),
                    ...listPointerPaths({ files: repository.files, selection, manifest, scopes }, file),
                ]),
            ),
    );
}

/**
 * Group the exclusions by source, before the ignores of a check.
 * @param session the repository to read.
 * @returns the exclusion groups in order.
 */
function buildIgnoreSections(
    session: Pick<Session, 'reads' | 'repository' | 'scopes' | 'neededToolManifests'>,
): IgnoreSection[] {
    const { reads, repository, scopes } = session;
    const declarations = listFileDeclarations(new Map(scopes.map(({ scope, selected }) => [scope.path, selected])));
    const tracked = repository.index.length === 0 ? repository.files : repository.index;
    const folders = [
        ...new Set(scopes.flatMap(({ selected }) => selected.flatMap((manifest) => manifest.ignored_folders))),
    ];
    const usesSemgrep = session.neededToolManifests.some((manifest) =>
        manifest.tools.some((tool) => tool.name === 'semgrep'),
    );
    const toolFiles = collectToolExclusions(session);
    return [
        {
            title: IGNORE_SECTION_TITLES.build,
            patterns: [
                ...BUILD_OUTPUT_PATTERNS.filter(
                    (pattern) =>
                        usesSemgrep ||
                        repository.files.some((file) =>
                            buildPathMatcher(
                                buildGlobSections([{ title: IGNORE_SECTION_TITLES.build, patterns: [pattern] }]),
                            )(file.path),
                        ),
                ),
                ...folders.filter((folder) => BUILD_OUTPUT_FOLDERS.has(folder)).map((folder) => `${folder}/`),
            ],
        },
        { title: IGNORE_SECTION_TITLES.gspot, patterns: [...GSPOT_FOLDER_PATTERNS, ...toolFiles] },
        {
            title: IGNORE_SECTION_TITLES.generators,
            patterns: [
                ...readLinguistPatterns(
                    reads,
                    tracked.map(({ path }) => path),
                ),
                ...declarations.flatMap(({ paths }) => paths),
            ],
        },
        {
            title: IGNORE_SECTION_TITLES.dependencies,
            patterns: folders.filter((folder) => !BUILD_OUTPUT_FOLDERS.has(folder)).map((folder) => `${folder}/`),
        },
        {
            title: IGNORE_SECTION_TITLES.lockfiles,
            patterns: LOCKFILES.filter((lockfile) =>
                repository.files.some(({ path }) => !isInGspotFolder(path) && basename(path) === lockfile.file),
            ).map(({ file }) => file),
        },
        { title: IGNORE_SECTION_TITLES.environment, patterns: [...LOCAL_ENVIRONMENT_PATTERNS] },
    ];
}

/**
 * Keep the reason with each check-wide path ignore.
 * @param view the settings of this scope.
 * @param check the ID whose ignores to keep.
 * @returns the check-wide path exclusions with their reasons.
 */
function buildSettingsSections(view: ScopeView, check: string): IgnoreSection[] {
    return view
        .ignoresFor(check)
        .filter(({ rule }) => rule === undefined)
        .map(({ reason, paths }) => ({ title: reason, patterns: paths }));
}

/**
 * Write ignore sections relative to the folder where the tool reads them.
 * @param options what to write.
 * @param options.sections the ordered exclusion groups and their reasons.
 * @param options.scope the folder from which the tool reads these patterns.
 * @param options.purpose the explanation at the start of the ignore file.
 * @returns the ignore file text, with paths relative to the scope.
 */
function ignoreFileText(options: { sections: IgnoreSection[]; scope: string; purpose: string }): string {
    const { sections, scope, purpose } = options;
    const seen = new Set<string>();
    const lines = sections.flatMap(({ title, patterns }) => {
        const projected = moveIgnorePatterns(patterns, scope);
        const ordered = projected.some((pattern) => pattern.startsWith('!'))
            ? projected
            : projected.toSorted((left, right) => left.localeCompare(right));
        const paths = ordered.filter((pattern) => {
            if (seen.has(pattern)) return false;
            seen.add(pattern);
            return true;
        });
        return paths.length === 0
            ? []
            : [
                  '',
                  ...title
                      .replaceAll('\r\n', '\n')
                      .replaceAll('\r', '\n')
                      .split('\n')
                      .map((line) => `# ${line}`),
                  ...paths,
              ];
    });
    return [`# ${purpose}`, ...lines, ''].join('\n');
}

/**
 * Convert the sections to the globs that tool files use.
 * @param sections the ordered exclusion groups and their written reasons.
 * @returns the globs, each once.
 */
function buildGlobSections(sections: IgnoreSection[]): string[] {
    const patterns = sections.flatMap((section) => section.patterns);
    return [
        ...new Set(
            patterns.map((pattern) => {
                const negative = pattern.startsWith('!') ? '!' : '';
                let path = negative === '' ? pattern : pattern.slice(1);
                const anchored = path.startsWith('/');
                if (anchored) path = path.slice(1);
                const folder = path.endsWith('/');
                const bare = folder ? path.slice(0, -1) : path;
                const prefix = anchored || bare.includes('/') ? '' : '**/';
                return `${negative}${prefix}${bare}${folder ? '/**' : ''}`;
            }),
        ),
    ];
}

/**
 * Build the Prettier ignore file with the shared section order and the written reasons.
 * @param context the tool file to build.
 * @returns the ignore file text.
 */
function buildPrettierignore(context: ToolFileContext): string {
    return ignoreFileText({
        sections: [
            ...buildIgnoreSections(context.session),
            ...buildSettingsSections(context.selection.view, 'format/prettier'),
        ],
        scope: dirname(context.targetPath) === '.' ? '' : dirname(context.targetPath),
        purpose: IGNORE_FILE_PURPOSES.prettier,
    });
}

/**
 * Build the Semgrep ignore file with every pattern relative to its scope.
 * @param context the tool file to build.
 * @returns the ignore file text.
 */
function buildSemgrepignore(context: ToolFileContext): string {
    return ignoreFileText({
        sections: [
            ...buildIgnoreSections(context.session),
            ...buildSettingsSections(context.selection.view, 'security/semgrep'),
        ],
        scope: dirname(context.targetPath) === '.' ? '' : dirname(context.targetPath),
        purpose: IGNORE_FILE_PURPOSES.semgrep,
    });
}

export { buildGlobSections, buildSemgrepignore, buildIgnoreSections, buildPrettierignore, buildSettingsSections };
