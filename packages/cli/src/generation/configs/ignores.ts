import { basename, join } from 'node:path/posix';

import { IGNORE_SECTION_TITLES } from '#cli/config/configurations/shared.ts';
import { CI_FILES } from '#cli/config/generation/builders.ts';
import { BUILD_OUTPUT_FOLDERS, BUILD_OUTPUT_PATTERNS, GSPOT_FOLDER_PATTERNS } from '#cli/config/generation/files.ts';
import { LOCKFILES } from '#cli/config/parsers/projects.ts';
import { GITLINK_MODE } from '#cli/config/repository/files.ts';
import { convertToGlob } from '#cli/configurations/ignores.ts';
import { listWrittenPaths } from '#cli/generation/configs/paths.ts';
import { listGitignorePatterns } from '#cli/repository/files/gitignore.ts';
import { isGspotPath } from '#cli/repository/files/ownership.ts';
import { listTrackedPaths } from '#cli/repository/files/tracked.ts';
import { readAuthoredLinguistPatterns } from '#cli/repository/git/attributes.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import { compareText } from '#cli/system/text/order.ts';
import type { IgnoreSection } from '#cli/types/configurations/shared.ts';
import type { ConfigTargets } from '#cli/types/engine/tool-runs.ts';
import type { Session } from '#cli/types/tools.ts';

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
            patterns: [...readAuthoredLinguistPatterns(cache, trackedPaths), ...generatorOutputs],
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
