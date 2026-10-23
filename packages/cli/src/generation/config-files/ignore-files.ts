import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { listIgnores } from '#cli/settings/scopes.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { readLinguistPatterns } from '#cli/repository/read.ts';
import { LEADING_SLASH } from '#cli/config/files/path-patterns.ts';
import { join, dirname, basename, relative } from 'node:path/posix';
import { buildPathMatcher } from '#cli/repository/files/matchers.ts';
import { LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import type { ScopeSettings } from '#cli/types/settings/inheritance.ts';
import { listGitignorePatterns } from '#cli/repository/files/gitignore.ts';
import { listPointerPaths } from '#cli/generation/config-files/pointers.ts';
import { listOwnedConfigFiles } from '#cli/generation/config-files/selection.ts';
import type { IgnoreSection, PlannedConfigFile } from '#cli/types/generation/files.ts';

import {
    BUILD_OUTPUT_FOLDERS,
    IGNORE_SECTION_TITLES,
    BUILD_OUTPUT_PATTERNS,
    GSPOT_FOLDER_PATTERNS,
    PRETTIERIGNORE_PURPOSE,
    LOCAL_ENVIRONMENT_PATTERNS,
} from '#cli/config/generation/config-files/ignore-files.ts';

function listGitIgnoredPatterns(session: Session, tracked: string[]): string[] {
    return listGitignorePatterns(session.reads, tracked).filter((pattern) => {
        if (pattern.replace(LEADING_SLASH, '').startsWith(`${DOT_GSPOT}/`)) return false;
        const matches = buildPathMatcher([convertToGlob(pattern)]);
        return !tracked.some((path) => matches(path));
    });
}

function listGeneratedPaths(session: Session): string[] {
    const paths = listOwnedConfigFiles(session).flatMap(({ configFile, owner }) => {
        const sourceTargets =
            configFile.source === undefined || configFile.target.startsWith(`${DOT_GSPOT}/`)
                ? []
                : [configFile.per_scope ? joinScope(owner.scope.folder.path, configFile.target) : configFile.target];
        return [...sourceTargets, ...listPointerPaths(owner, configFile)];
    });
    return [...new Set(paths)].map((path) => `/${path}`);
}

/**
 * Group path ignores by source, before the ignores of a check.
 *
 * @param session the repository to read.
 * @returns the exclusion groups in order.
 */
export function buildIgnoreSections(session: Session): IgnoreSection[] {
    const { reads, repository, scopes } = session;
    const generatorOutputs = scopes.flatMap(({ folder, configurations }) =>
        configurations.flatMap((configuration) => configuration.generated.map((file) => join(folder.path, file))),
    );
    const trackedPaths = (repository.index.length === 0 ? repository.files : repository.index).map(({ path }) => path);
    const folders = [
        ...new Set(
            scopes.flatMap(({ configurations }) =>
                configurations.flatMap((configuration) => configuration.ignored_paths),
            ),
        ),
    ];
    const configFiles = listGeneratedPaths(session);
    return [
        {
            key: 'build',
            title: IGNORE_SECTION_TITLES.build,
            patterns: [
                ...BUILD_OUTPUT_PATTERNS.filter((pattern) => {
                    const matches = buildPathMatcher([convertToGlob(pattern)]);
                    return repository.files.some((file) => matches(file.path));
                }),
                ...folders.filter((folder) => BUILD_OUTPUT_FOLDERS.has(folder)).map((folder) => `${folder}/`),
            ],
        },
        {
            key: 'git',
            title: IGNORE_SECTION_TITLES.git,
            patterns: listGitIgnoredPatterns(session, trackedPaths),
        },
        { key: 'gspot', title: IGNORE_SECTION_TITLES.gspot, patterns: [...GSPOT_FOLDER_PATTERNS, ...configFiles] },
        {
            key: 'generators',
            title: IGNORE_SECTION_TITLES.generators,
            patterns: [...readLinguistPatterns(reads, trackedPaths), ...generatorOutputs],
        },
        {
            key: 'configurations',
            title: IGNORE_SECTION_TITLES.configurations,
            patterns: folders.filter((folder) => !BUILD_OUTPUT_FOLDERS.has(folder)),
        },
        {
            key: 'lockfiles',
            title: IGNORE_SECTION_TITLES.lockfiles,
            patterns: LOCKFILES.filter((lockfile) =>
                repository.files.some(
                    ({ path }) => !path.startsWith(`${DOT_GSPOT}/`) && basename(path) === lockfile.file,
                ),
            ).map(({ file }) => file),
        },
        { key: 'environment', title: IGNORE_SECTION_TITLES.environment, patterns: [...LOCAL_ENVIRONMENT_PATTERNS] },
        ...session.settingsFile.settings.ignore
            .filter((ignore) => ignore.check === undefined)
            .map((ignore): IgnoreSection => ({ key: 'settings', title: ignore.reason, patterns: ignore.paths ?? [] })),
    ];
}

/**
 * Keep the reason with each check-wide path ignore.
 *
 * @param scopeSettings the settings of this scope.
 * @param check the ID whose ignores to keep.
 * @returns the check-wide path ignores with their reasons.
 */
export function listCheckIgnoreSections(scopeSettings: ScopeSettings, check: string): IgnoreSection[] {
    return listIgnores(scopeSettings, check)
        .filter((ignore) => ignore.rule === undefined && ignore.names === undefined)
        .map(({ reason, paths }): IgnoreSection => ({ key: 'settings', title: reason, patterns: paths }));
}

/**
 * Keep each pattern in its first section.
 *
 * @param sections the ordered sections.
 * @returns sections with repeated patterns removed.
 */
export function keepFirstPatterns(sections: IgnoreSection[]): IgnoreSection[] {
    const seen = new Set<string>();
    return sections.map((section) => ({
        ...section,
        patterns: section.patterns.filter((pattern) => {
            if (seen.has(pattern)) return false;
            seen.add(pattern);
            return true;
        }),
    }));
}

/**
 * Turn each reason line into a comment.
 *
 * @param reason the written reason.
 * @param indent the spacing before each comment.
 * @returns the comment lines.
 */
export function formatReasonLines(reason: string, indent: string): string[] {
    return reason
        .replaceAll('\r\n', '\n')
        .replaceAll('\r', '\n')
        .split('\n')
        .map((line) => `${indent}# ${line}`);
}

function formatIgnoreFile(sections: IgnoreSection[]): string {
    const ordered = sections.map((section) => ({
        ...section,
        patterns: section.patterns.some((pattern) => pattern.startsWith('!'))
            ? section.patterns
            : section.patterns.toSorted((left, right) => left.localeCompare(right)),
    }));
    const lines = keepFirstPatterns(ordered).flatMap(({ title, patterns: paths }) => {
        return paths.length === 0 ? [] : ['', ...formatReasonLines(title, ''), ...paths];
    });
    return [`# ${PRETTIERIGNORE_PURPOSE}`, ...lines, ''].join('\n');
}

function convertToGlob(pattern: string): string {
    const negative = pattern.startsWith('!') ? '!' : '';
    let path = negative === '' ? pattern : pattern.slice(1);
    const anchored = path.startsWith('/');
    if (anchored) path = path.slice(1);
    const folder = path.endsWith('/');
    const bare = folder ? path.slice(0, -1) : path;
    const prefix = anchored || bare.includes('/') ? '' : '**/';
    return `${negative}${prefix}${bare}${folder ? '/**' : ''}`;
}

/**
 * Convert the sections to the globs that config files use.
 *
 * @param sections the ordered exclusion groups and their written reasons.
 * @returns the globs, each once.
 */
export function convertToGlobs(sections: IgnoreSection[]): string[] {
    const patterns = sections.flatMap((section) => section.patterns);
    return [...new Set(patterns.map((pattern) => convertToGlob(pattern)))];
}

/**
 * List the shared and check-specific globs that a Python tool leaves out.
 *
 * @param planned the config file and its scope.
 * @param check the check whose path ignores apply.
 * @returns the globs relative to the config file.
 */
export function listPythonIgnoredGlobs(planned: PlannedConfigFile, check: string): string[] {
    const base = relative(dirname(planned.targetPath), '.');
    const ignoredGlobs = convertToGlobs(buildIgnoreSections(planned.session)).filter(
        (pattern) =>
            pattern.endsWith('/**') ||
            planned.configuration.files.extensions.some((extension) => pattern.endsWith(extension)),
    );
    return [
        ...ignoredGlobs,
        ...listIgnores(planned.scope.settings, check)
            .filter((ignore) => ignore.rule === undefined && ignore.names === undefined)
            .flatMap((ignore) => ignore.paths),
    ].map((path) => `${base}/${path}`);
}

/**
 * Build .prettierignore: the ignored paths in the shared section order, with the written reasons.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the ignore file text.
 */
export function buildPrettierignoreFile(planned: PlannedConfigFile): string {
    return formatIgnoreFile([
        ...buildIgnoreSections(planned.session),
        ...listCheckIgnoreSections(planned.scope.settings, 'format/prettier'),
    ]);
}
