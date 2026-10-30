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
import { listLinkFilePaths } from '#cli/generation/config-files/link-files.ts';
import { GITHUB_WORKFLOW, GITLAB_WORKFLOW } from '#cli/config/generation/ci.ts';
import { listOwnedConfigFiles } from '#cli/generation/config-files/selection.ts';
import type { IgnoreSection, PlannedConfigFile } from '#cli/types/generation/files.ts';
import { isMarkdownlintShared } from '#cli/generation/configurations/language/markdown.ts';

import {
    PRETTIER_CHECK,
    BUILD_OUTPUT_FOLDERS,
    IGNORE_SECTION_TITLES,
    BUILD_OUTPUT_PATTERNS,
    GSPOT_FOLDER_PATTERNS,
} from '#cli/config/generation/config-files/ignore-files.ts';

/**
List the paths outside .gspot/ that a run writes: the root targets and link file paths of the config files it writes, and the CI workflow when CI runs.

@param session the scopes and the settings.
@returns the paths, each from the repository root with a leading slash.
*/
export function listWrittenPaths(session: Session): string[] {
    const configFiles = listOwnedConfigFiles(session);
    const paths = configFiles.flatMap((owned) => {
        const { configFile, owner } = owned;
        const sourceTargets =
            configFile.source === undefined || configFile.target.startsWith(`${GSPOT_FOLDER}/`)
                ? []
                : [configFile.per_scope ? joinScope(owner.scope.path, configFile.target) : configFile.target];
        return [
            ...sourceTargets,
            ...(isMarkdownlintShared(owned, configFiles) ? [] : listLinkFilePaths(owner, configFile)),
        ];
    });
    if (session.settings.ci?.enabled === true)
        paths.push(session.settings.ci.provider === 'github' ? GITHUB_WORKFLOW : GITLAB_WORKFLOW);
    return [...new Set(paths)].toSorted(compareText).map((path) => `/${path}`);
}

/**
Group path ignores by source, before the ignores of a check.

@param session the repository to read.
*/
export function buildIgnoreSections(session: Session): IgnoreSection[] {
    const { cache, repository, scopes } = session;
    const generatorOutputs = scopes.flatMap(({ path: scopePath, configurations }) =>
        configurations.flatMap((configuration) => configuration.generated.map((file) => join(scopePath, file))),
    );
    const trackedPaths = (repository.index.length === 0 ? repository.files : repository.index).map(({ path }) => path);
    const folders = [
        ...new Set(
            scopes.flatMap(({ configurations }) =>
                configurations.flatMap((configuration) => configuration.ignored_paths),
            ),
        ),
    ];
    const configFiles = listWrittenPaths(session);
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
            patterns: [...readLinguistPatterns(cache, trackedPaths), ...generatorOutputs],
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
        ...session.settings.ignore
            .filter((ignore) => ignore.check === undefined)
            .map((ignore): IgnoreSection => ({ key: 'settings', title: ignore.reason, patterns: ignore.paths ?? [] })),
    ];
}

/**
List the path ignores of one check, each with its written reason.

@param scopeSettings the merged settings and ignores of the scope.
@param checkId the ID whose path ignores apply.
@returns one section for each path ignore.
*/
export function listCheckIgnoreSections(scopeSettings: ScopeSettings, checkId: string): IgnoreSection[] {
    return listIgnores(scopeSettings, checkId)
        .filter((ignore) => ignore.rule === undefined)
        .map(({ reason, paths }): IgnoreSection => ({ key: 'settings', title: reason, patterns: paths }));
}

/**
Keep each pattern in its first section.

@param sections the ordered sections.
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
    const patterns = sections.flatMap((section) => [
        ...section.patterns.filter((pattern) => !pattern.startsWith('!')),
        ...section.patterns.filter((pattern) => pattern.startsWith('!')),
    ]);
    return [...new Set(patterns.map((pattern) => convertToGlob(pattern)))];
}

/**
Build .prettierignore: the ignored paths in the shared section order, with the written reasons.

@param planned the config file to build.
*/
export function buildPrettierignoreFile(planned: PlannedConfigFile): string {
    const ordered = [
        ...buildIgnoreSections(planned.session),
        ...listCheckIgnoreSections(planned.scope.settings, PRETTIER_CHECK),
    ].map((section) => ({
        ...section,
        patterns: [
            ...section.patterns.filter((pattern) => !pattern.startsWith('!')).toSorted(compareText),
            ...section.patterns.filter((pattern) => pattern.startsWith('!')).toSorted(compareText),
        ],
    }));
    const lines = keepFirstPatterns(ordered).flatMap(({ title, patterns }) =>
        patterns.length === 0
            ? []
            : [
                  '',
                  ...title
                      .replaceAll('\r\n', '\n')
                      .replaceAll('\r', '\n')
                      .split('\n')
                      .map((line) => `# ${line}`),
                  ...patterns,
              ],
    );
    return [...lines, ''].join('\n').trimStart();
}
