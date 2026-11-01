import { join, basename } from 'node:path/posix';
import { compareText } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { LOCKFILES } from '#cli/config/files/lockfiles.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { listLinkFilePaths } from '#cli/generation/links.ts';
import { convertToGlob } from '#cli/configurations/ignores.ts';
import { readLinguistPatterns } from '#cli/repository/read.ts';
import { listOwnedConfigs } from '#cli/generation/selection.ts';
import type { IgnoreSection } from '#cli/types/generation/files.ts';
import { isMarkdownlintShared } from '#cli/configurations/language/markdown/generate.ts';

import {
    GITHUB_WORKFLOW,
    GITLAB_WORKFLOW,
    BUILD_OUTPUT_FOLDERS,
    IGNORE_SECTION_TITLES,
    BUILD_OUTPUT_PATTERNS,
    GSPOT_FOLDER_PATTERNS,
} from '#cli/config/generation/generation.ts';

/**
List the paths outside .gspot/ that a run writes: the root targets and link file paths of the config files it writes, and the CI workflow when CI runs.

@param session the scopes and the settings.
@returns the paths, each from the repository root with a leading slash.
*/
export function listWrittenPaths(session: Session): string[] {
    const configs = listOwnedConfigs(session);
    const paths = configs.flatMap((owned) => {
        const { config, owner } = owned;
        const sourceTargets =
            config.source === undefined || config.target.startsWith(`${GSPOT_FOLDER}/`)
                ? []
                : [config.per_scope ? joinScope(owner.scope.path, config.target) : config.target];
        return [...sourceTargets, ...(isMarkdownlintShared(owned, configs) ? [] : listLinkFilePaths(owner, config))];
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
    const configs = listWrittenPaths(session);
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
        { key: 'gspot', title: IGNORE_SECTION_TITLES.gspot, patterns: [...GSPOT_FOLDER_PATTERNS, ...configs] },
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
