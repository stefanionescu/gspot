import { basename, join } from 'node:path/posix';

import { IGNORE_SECTION_TITLES } from '#cli/config/configurations/shared.ts';
import {
    BUILD_OUTPUT_FOLDERS,
    BUILD_OUTPUT_PATTERNS,
    CI_FILES,
    GSPOT_FOLDER_PATTERNS,
} from '#cli/config/generation/files.ts';
import { LOCKFILES } from '#cli/config/parsers/projects.ts';
import { GITLINK_MODE } from '#cli/config/repository/files.ts';
import { convertToGlob } from '#cli/configurations/ignores.ts';
import { listOwnedConfigs } from '#cli/generation/owned.ts';
import { listOutsideTargets, listPointerPaths } from '#cli/generation/pointers.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { listGitignorePatterns } from '#cli/repository/files/gitignore.ts';
import { listTrackedPaths } from '#cli/repository/files/tracked.ts';
import { readLinguistPatterns } from '#cli/repository/read.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import { compareText } from '#cli/system/text/order.ts';
import type { IgnoreSection } from '#cli/types/configurations/shared.ts';
import type { ConfigTargets } from '#cli/types/engine/tool-runs.ts';
import type { OwnedConfig } from '#cli/types/generation.ts';
import type { Session } from '#cli/types/tools.ts';

export function isPointerInherited(owned: OwnedConfig, generated: Pick<ConfigTargets, 'targets'>): boolean {
    const { config, owner } = owned;
    const files = ['', owner.scope.path].map((scopePath) => generated.targets.get(scopePath)?.get(config.target));
    return config.pointer?.inherit === true && owner.scope.path !== '' && files.every((file) => file === config.target);
}

/**
List the configs and pointer files that gspot writes outside its folder, without the CI workflow.
*/
export function listWrittenPaths(session: Session, generated: Pick<ConfigTargets, 'targets'>): string[] {
    const paths = listOwnedConfigs(session).flatMap((owned) => {
        const { config, owner } = owned;
        return [
            ...listOutsideTargets(owner.scope.path, config),
            ...(isPointerInherited(owned, generated) ? [] : listPointerPaths(owner, config)),
        ];
    });
    return [...new Set(paths)].toSorted(compareText);
}

export function buildGspotSection(session: Session, generated: Pick<ConfigTargets, 'targets'>): IgnoreSection {
    const { ci } = session.settings;
    const paths = [...listWrittenPaths(session, generated), ...(ci?.enabled === true ? [CI_FILES[ci.provider]] : [])];
    return {
        key: 'gspot',
        title: IGNORE_SECTION_TITLES.gspot,
        patterns: [...GSPOT_FOLDER_PATTERNS, ...paths.toSorted(compareText).map((path) => `/${path}`)],
    };
}

export function buildIgnoreSections(session: Session, generated: Pick<ConfigTargets, 'targets'>): IgnoreSection[] {
    const { cache, repository, scopes } = session;
    const generatorOutputs = scopes.flatMap(({ path: scopePath, configurations }) =>
        configurations.flatMap((configuration) => configuration.generated.map((file) => join(scopePath, file))),
    );
    const trackedPaths = listTrackedPaths(repository);
    const folders = [
        ...new Set(
            scopes.flatMap(({ configurations }) =>
                configurations.flatMap((configuration) => configuration.ignored_paths),
            ),
        ),
    ];
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
        buildGspotSection(session, generated),
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
        {
            key: 'gitignore',
            title: IGNORE_SECTION_TITLES.gitignore,
            patterns: listGitignorePatterns(cache, trackedPaths),
        },
        ...session.settings.ignore
            .filter((ignore) => ignore.check === undefined)
            .map((ignore): IgnoreSection => ({ key: 'settings', title: ignore.reason, patterns: ignore.paths ?? [] })),
    ];
}
