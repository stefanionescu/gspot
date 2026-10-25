import { join, basename } from 'node:path/posix';
import { compareText } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { listIgnores } from '#cli/settings/scopes.ts';
import { LOCKFILES } from '#cli/config/files/lockfiles.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { readLinguistPatterns } from '#cli/repository/read.ts';
import type { ScopeSettings } from '#cli/types/settings/inheritance.ts';
import { listPointerPaths } from '#cli/generation/config-files/pointers.ts';
import { listOwnedConfigFiles } from '#cli/generation/config-files/selection.ts';
import type { IgnoreSection, PlannedConfigFile } from '#cli/types/generation/files.ts';
import { isMarkdownlintShared } from '#cli/generation/configurations/language/markdown.ts';

import {
    BUILD_OUTPUT_FOLDERS,
    IGNORE_SECTION_TITLES,
    BUILD_OUTPUT_PATTERNS,
    GSPOT_FOLDER_PATTERNS,
    PRETTIERIGNORE_PURPOSE,
    LOCAL_ENVIRONMENT_PATTERNS,
} from '#cli/config/generation/config-files/ignore-files.ts';

function listGeneratedPaths(session: Session): string[] {
    const configFiles = listOwnedConfigFiles(session);
    const paths = configFiles.flatMap((owned) => {
        const { configFile, owner } = owned;
        const sourceTargets =
            configFile.source === undefined || configFile.target.startsWith(`${GSPOT_FOLDER}/`)
                ? []
                : [configFile.per_scope ? joinScope(owner.scope.folder.path, configFile.target) : configFile.target];
        return [
            ...sourceTargets,
            ...(isMarkdownlintShared(owned, configFiles) ? [] : listPointerPaths(owner, configFile)),
        ];
    });
    return [...new Set(paths)].map((path) => `/${path}`);
}

/**
Group path ignores by source, before the ignores of a check.

@param session the repository to read.
@returns the exclusion groups in order.
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
                    const isMatch = buildPathMatcher([convertToGlob(pattern)]);
                    return repository.files.some((file) => isMatch(file.path));
                }),
                ...folders.filter((folder) => BUILD_OUTPUT_FOLDERS.has(folder)).map((folder) => `${folder}/`),
            ],
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
                    ({ path }) => !path.startsWith(`${GSPOT_FOLDER}/`) && basename(path) === lockfile.file,
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
List the path ignores of one check, each with its written reason.

@param scopeSettings the merged settings and ignores of the scope.
@param check the ID whose path ignores apply.
@returns one section for each path ignore.
*/
export function listCheckIgnoreSections(scopeSettings: ScopeSettings, check: string): IgnoreSection[] {
    return listIgnores(scopeSettings, check)
        .filter((ignore) => ignore.rule === undefined && ignore.names === undefined)
        .map(({ reason, paths }): IgnoreSection => ({ key: 'settings', title: reason, patterns: paths }));
}

/**
Join shared exclusions with the path ignores of one check.

@param planned the config file and its scope.
@param check the ID whose path ignores apply.
@returns the exclusion groups in order.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
export function listIgnoreSections(planned: PlannedConfigFile, check: string): IgnoreSection[] {
    return [...buildIgnoreSections(planned.session), ...listCheckIgnoreSections(planned.scope.settings, check)];
}

/**
Keep each pattern in its first section.

@param sections the ordered sections.
@returns sections with repeated patterns removed.
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
Turn each reason line into a comment.

@param reason the written reason.
@param indent the spacing before each comment.
@returns the comment lines.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in 2 files share it.
export function formatReasonLines(reason: string, indent: string): string[] {
    return reason
        .replaceAll('\r\n', '\n')
        .replaceAll('\r', '\n')
        .split('\n')
        .map((line) => `${indent}# ${line}`);
}

function convertToGlob(pattern: string): string {
    const negative = pattern.startsWith('!') ? '!' : '';
    let path = negative === '' ? pattern : pattern.slice(1);
    const isAnchored = path.startsWith('/');
    if (isAnchored) path = path.slice(1);
    const isFolder = path.endsWith('/');
    const bare = isFolder ? path.slice(0, -1) : path;
    const prefix = isAnchored || bare.includes('/') ? '' : '**/';
    return `${negative}${prefix}${bare}${isFolder ? '/**' : ''}`;
}

/**
Convert the sections to the globs that config files use.

@param sections the ordered exclusion groups and their written reasons.
@returns the globs, each once.
*/
export function convertToGlobs(sections: IgnoreSection[]): string[] {
    const patterns = sections.flatMap((section) => section.patterns);
    return [...new Set(patterns.map((pattern) => convertToGlob(pattern)))];
}

/**
Build .prettierignore: the ignored paths in the shared section order, with the written reasons.

@param planned the config file with its scope, level, and target path.
@returns the ignore file text.
*/
export function buildPrettierignoreFile(planned: PlannedConfigFile): string {
    const ordered = listIgnoreSections(planned, 'format/prettier').map((section) => ({
        ...section,
        patterns: section.patterns.some((pattern) => pattern.startsWith('!'))
            ? section.patterns
            : section.patterns.toSorted((left, right) => compareText(left, right)),
    }));
    const lines = keepFirstPatterns(ordered).flatMap(({ title, patterns }) =>
        patterns.length === 0 ? [] : ['', ...formatReasonLines(title, ''), ...patterns],
    );
    return [`# ${PRETTIERIGNORE_PURPOSE}`, ...lines, ''].join('\n');
}
