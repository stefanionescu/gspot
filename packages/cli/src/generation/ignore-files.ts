// Build the shared ignore sections for .prettierignore and the tool exclusions.
import { joinScope } from '#cli/repository/scopes.ts';
import type { Session } from '#cli/types/planning.ts';
import { LEADING_SLASH } from '#cli/config/system/paths.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { listPointerPaths } from '#cli/generation/pointers.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { readLinguistPatterns } from '#cli/repository/read.ts';
import { type ScopeView } from '#cli/types/settings/values.ts';
import { join, dirname, basename, relative } from 'node:path/posix';
import { listGitignorePatterns } from '#cli/repository/gitignore.ts';
import { listIgnores, isFileIgnore } from '#cli/settings/scope-view.ts';
import { PRETTIERIGNORE_PURPOSE } from '#cli/config/generation/formatting.ts';
import { listToolFileDeclarations } from '#cli/generation/settings/declarations.ts';
import { type IgnoreSection, type ToolFileContext } from '#cli/types/generation/files.ts';

import {
    BUILD_OUTPUT_FOLDERS,
    GSPOT_FOLDER_PATTERNS,
    IGNORE_SECTION_TITLES,
    BUILD_OUTPUT_PATTERNS,
    LOCAL_ENVIRONMENT_PATTERNS,
} from '#cli/config/generation/ignore-files.ts';

// Tool files leave out what Git ignores, unless a tracked file matches the pattern, such as a force-added file. The
// managed block names .gspot/ paths, which the section of generated files already holds.
function listGitIgnoredPatterns(session: Session, tracked: string[]): string[] {
    return listGitignorePatterns(session.reads, tracked).filter((pattern) => {
        if (isInGspotFolder(pattern.replace(LEADING_SLASH, ''))) return false;
        const matches = buildPathMatcher([convertToGlob(pattern)]);
        return !tracked.some((path) => matches(path));
    });
}

// Include generated files and pointers outside .gspot. Keep inherited pointers because their final text determines
// which scopes write them.
function collectToolExclusions(session: Session): string[] {
    const paths = listToolFileDeclarations(session).flatMap(({ toolFile, owner }) => {
        const whole =
            toolFile.source === undefined || isInGspotFolder(toolFile.target)
                ? []
                : [toolFile.per_scope ? joinScope(owner.selection.scope.path, toolFile.target) : toolFile.target];
        return [...whole, ...listPointerPaths(owner, toolFile)];
    });
    return [...new Set(paths)].map((path) => `/${path}`);
}

/**
 * Group the exclusions by source, before the ignores of a check.
 *
 * @param session the repository to read.
 * @returns the exclusion groups in order.
 */
function buildIgnoreSections(session: Session): IgnoreSection[] {
    const { reads, repository, scopes } = session;
    // The tool files and pointers have their own section. Keep only the files that project generators write.
    const generatorOutputs = scopes.flatMap(({ scope, selected }) =>
        selected.flatMap((manifest) => manifest.generated.map((file) => join(scope.path, file))),
    );
    const trackedPaths = (repository.index.length === 0 ? repository.files : repository.index).map(({ path }) => path);
    const folders = [
        ...new Set(scopes.flatMap(({ selected }) => selected.flatMap((manifest) => manifest.ignored_paths))),
    ];
    const toolFiles = collectToolExclusions(session);
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
        { key: 'gspot', title: IGNORE_SECTION_TITLES.gspot, patterns: [...GSPOT_FOLDER_PATTERNS, ...toolFiles] },
        {
            key: 'generators',
            title: IGNORE_SECTION_TITLES.generators,
            patterns: [...readLinguistPatterns(reads, trackedPaths), ...generatorOutputs],
        },
        {
            key: 'dependencies',
            title: IGNORE_SECTION_TITLES.dependencies,
            patterns: folders.filter((folder) => !BUILD_OUTPUT_FOLDERS.has(folder)),
        },
        {
            key: 'lockfiles',
            title: IGNORE_SECTION_TITLES.lockfiles,
            patterns: LOCKFILES.filter((lockfile) =>
                repository.files.some(({ path }) => !isInGspotFolder(path) && basename(path) === lockfile.file),
            ).map(({ file }) => file),
        },
        { key: 'environment', title: IGNORE_SECTION_TITLES.environment, patterns: [...LOCAL_ENVIRONMENT_PATTERNS] },
        ...session.settingsFile.settings.ignore
            .filter((entry) => entry.check === undefined)
            .map((entry): IgnoreSection => ({ key: 'settings', title: entry.reason, patterns: entry.paths ?? [] })),
    ];
}

/**
 * Keep the reason with each check-wide path ignore.
 *
 * @param view the settings of this scope.
 * @param check the ID whose ignores to keep.
 * @returns the check-wide path exclusions with their reasons.
 */
function buildSettingsSections(view: ScopeView, check: string): IgnoreSection[] {
    return listIgnores(view, check)
        .filter((entry) => isFileIgnore(entry))
        .map(({ reason, paths }): IgnoreSection => ({ key: 'settings', title: reason, patterns: paths }));
}

/**
 * Keep each pattern in its first section.
 *
 * @param sections the ordered sections.
 * @returns sections with repeated patterns removed.
 */
function keepFirstPatterns(sections: IgnoreSection[]): IgnoreSection[] {
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
function formatReasonLines(reason: string, indent: string): string[] {
    return reason
        .replaceAll('\r\n', '\n')
        .replaceAll('\r', '\n')
        .split('\n')
        .map((line) => `${indent}# ${line}`);
}

/**
 * Write ignore sections for a tool that reads them from the root.
 *
 * @param sections the ordered exclusion groups and their reasons.
 * @returns the ignore file text.
 */
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

/**
 * Convert an ignore pattern to the glob a tool uses.
 *
 * @param pattern the ignore pattern.
 * @returns its equivalent glob.
 */
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
 * Convert the sections to the globs that tool files use.
 *
 * @param sections the ordered exclusion groups and their written reasons.
 * @returns the globs, each once.
 */
function buildGlobSections(sections: IgnoreSection[]): string[] {
    const patterns = sections.flatMap((section) => section.patterns);
    return [...new Set(patterns.map((pattern) => convertToGlob(pattern)))];
}

/**
 * Build the Prettier ignore file with the shared section order and the written reasons.
 *
 * @param context the tool file to build.
 * @returns the ignore file text.
 */
function buildPrettierignore(context: ToolFileContext): string {
    return formatIgnoreFile([
        ...buildIgnoreSections(context.session),
        ...buildSettingsSections(context.selection.view, 'format/prettier'),
    ]);
}

/**
 * List the globs that a tool leaves out: the shared ignore sections, then the path ignores of one check.
 *
 * @param session the repository to read.
 * @param view the settings of the scope.
 * @param check the ID whose path ignores to add.
 * @returns the globs, each once.
 */
function listIgnoredGlobs(session: Session, view: ScopeView, check: string): string[] {
    return buildGlobSections([...buildIgnoreSections(session), ...buildSettingsSections(view, check)]);
}

/**
 * List the shared and check-specific globs that a Python tool leaves out.
 *
 * @param context the tool file and its scope.
 * @param check the check whose path ignores apply.
 * @returns the globs relative to the tool file.
 */
function listPythonIgnoredGlobs(context: ToolFileContext, check: string): string[] {
    const base = relative(dirname(context.targetPath), '.');
    const exclusions = buildGlobSections(buildIgnoreSections(context.session)).filter(
        (pattern) =>
            pattern.endsWith('/**') ||
            context.manifest.files.extensions.some((extension) => pattern.endsWith(extension)),
    );
    return [
        ...exclusions,
        ...listIgnores(context.selection.view, check)
            .filter((entry) => isFileIgnore(entry))
            .flatMap((entry) => entry.paths),
    ].map((path) => `${base}/${path}`);
}

export {
    listIgnoredGlobs,
    keepFirstPatterns,
    formatReasonLines,
    buildGlobSections,
    buildIgnoreSections,
    buildPrettierignore,
    buildSettingsSections,
    listPythonIgnoredGlobs,
};
