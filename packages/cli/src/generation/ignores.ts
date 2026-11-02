import { join, basename } from 'node:path/posix';
import { compareText } from '#cli/system/text.ts';
import type { Session } from '#cli/types/tools.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { GITLINK_MODE } from '#cli/config/repository/files.ts';
import { convertToGlob } from '#cli/configurations/ignores.ts';
import { listPointerPaths } from '#cli/generation/pointers.ts';
import { readLinguistPatterns } from '#cli/repository/read.ts';
import { listOwnedConfigs } from '#cli/generation/selection.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { LOCKFILES } from '#cli/config/repository/javascript.ts';
import type { ConfigTargets } from '#cli/types/engine/tool-runs.ts';
import type { OwnedConfig } from '#cli/types/configurations/language.ts';
import type { IgnoreSection } from '#cli/types/configurations/general.ts';
import { IGNORE_SECTION_TITLES } from '#cli/config/configurations/registry.ts';

import {
    GITHUB_WORKFLOW,
    GITLAB_WORKFLOW,
    BUILD_OUTPUT_FOLDERS,
    BUILD_OUTPUT_PATTERNS,
    GSPOT_FOLDER_PATTERNS,
} from '#cli/config/generation.ts';

/**
Check whether a scope reads the root config of a tool that walks up to its parent configs, so it needs no pointer.

@param owned the config file and the scope that owns it.
@param generated the file of each config in each scope.
*/
export function isPointerInherited(owned: OwnedConfig, generated: Pick<ConfigTargets, 'targets'>): boolean {
    const { config, owner } = owned;
    const files = ['', owner.scope.path].map((scope) => generated.targets.get(scope)?.get(config.target));
    return config.pointer?.inherit === true && owner.scope.path !== '' && files.every((file) => file === config.target);
}

/**
List the paths outside .gspot/ that a run writes: the root targets and pointer file paths of the config files it writes, and the CI workflow when CI runs.

@param session the scopes and the settings.
@param generated the file of each config in each scope.
@returns the paths, each from the repository root with a leading slash.
*/
export function listWrittenPaths(session: Session, generated: Pick<ConfigTargets, 'targets'>): string[] {
    const paths = listOwnedConfigs(session).flatMap((owned) => {
        const { config, owner } = owned;
        const sourceTargets =
            config.source === undefined || isGspotPath(config.target)
                ? []
                : [config.per_scope ? joinScope(owner.scope.path, config.target) : config.target];
        return [...sourceTargets, ...(isPointerInherited(owned, generated) ? [] : listPointerPaths(owner, config))];
    });
    if (session.settings.ci?.enabled === true)
        paths.push(session.settings.ci.provider === 'github' ? GITHUB_WORKFLOW : GITLAB_WORKFLOW);
    return [...new Set(paths)].toSorted(compareText).map((path) => `/${path}`);
}

/**
Group path ignores by source, before the ignores of a check.

@param session the repository to read.
@param generated the file of each config in each scope.
*/
export function buildIgnoreSections(session: Session, generated: Pick<ConfigTargets, 'targets'>): IgnoreSection[] {
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
    const configs = listWrittenPaths(session, generated);
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
                repository.files.some(({ path }) => !isGspotPath(path) && basename(path) === lockfile.file),
            ).map(({ file }) => file),
        },
        {
            key: 'submodules',
            title: IGNORE_SECTION_TITLES.submodules,
            patterns: repository.index.filter(({ mode }) => mode === GITLINK_MODE).map(({ path }) => `/${path}/`),
        },
        ...session.settings.ignore
            .filter((ignore) => ignore.check === undefined)
            .map((ignore): IgnoreSection => ({ key: 'settings', title: ignore.reason, patterns: ignore.paths ?? [] })),
    ];
}
