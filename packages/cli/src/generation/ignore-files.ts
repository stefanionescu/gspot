// Build the shared ignore sections for .prettierignore and the tool exclusions.
import { join, basename } from 'node:path/posix';
import { joinScope } from '#cli/repository/scopes.ts';
import type { Session } from '#cli/types/planning.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { listPointerPaths } from '#cli/generation/pointers.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { readLinguistPatterns } from '#cli/repository/read.ts';
import { type ScopeView } from '#cli/types/settings/values.ts';
import { IGNORE_FILE_PURPOSES } from '#cli/config/generation/formatting.ts';
import { listToolFileDeclarations } from '#cli/generation/tool-files/declarations.ts';
import { type IgnoreSection, type ToolFileContext } from '#cli/types/generation/files.ts';

import {
    BUILD_OUTPUT_FOLDERS,
    GSPOT_FOLDER_PATTERNS,
    IGNORE_SECTION_TITLES,
    BUILD_OUTPUT_PATTERNS,
    LOCAL_ENVIRONMENT_PATTERNS,
} from '#cli/config/generation/ignore-files.ts';

// Collect the generated files and pointers outside .gspot that this run writes, so that scanners leave them alone.
function collectToolExclusions(session: Session): string[] {
    const paths = listToolFileDeclarations(session).flatMap(({ toolFile, owner }) => {
        if (toolFile.fragment) return [];
        const whole =
            toolFile.source === undefined || isInGspotFolder(toolFile.target)
                ? []
                : [toolFile.per_scope ? joinScope(owner.selection.scope.path, toolFile.target) : toolFile.target];
        return [...whole, ...listPointerPaths(owner, toolFile)];
    });
    return [...new Set(paths)];
}

/**
 * Group the exclusions by source, before the ignores of a check.
 * @param session the repository to read.
 * @returns the exclusion groups in order.
 */
function buildIgnoreSections(session: Session): IgnoreSection[] {
    const { reads, repository, scopes } = session;
    // The tool files and pointers have their own section. Keep only the files that project generators write.
    const generatorOutputs = scopes.flatMap(({ scope, selected }) =>
        selected.flatMap((manifest) => manifest.generated.map((file) => join(scope.path, file))),
    );
    const tracked = repository.index.length === 0 ? repository.files : repository.index;
    const folders = [
        ...new Set(scopes.flatMap(({ selected }) => selected.flatMap((manifest) => manifest.ignored_folders))),
    ];
    const toolFiles = collectToolExclusions(session);
    return [
        {
            title: IGNORE_SECTION_TITLES.build,
            patterns: [
                ...BUILD_OUTPUT_PATTERNS.filter((pattern) => {
                    const matches = buildPathMatcher(
                        buildGlobSections([{ title: IGNORE_SECTION_TITLES.build, patterns: [pattern] }]),
                    );
                    return repository.files.some((file) => matches(file.path));
                }),
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
                ...generatorOutputs,
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
 * Write ignore sections for a tool that reads them from the root.
 * @param options what to write.
 * @param options.sections the ordered exclusion groups and their reasons.
 * @param options.purpose the explanation at the start of the ignore file.
 * @returns the ignore file text.
 */
function ignoreFileText(options: { sections: IgnoreSection[]; purpose: string }): string {
    const { sections, purpose } = options;
    const seen = new Set<string>();
    const lines = sections.flatMap(({ title, patterns }) => {
        const ordered = patterns.some((pattern) => pattern.startsWith('!'))
            ? patterns
            : patterns.toSorted((left, right) => left.localeCompare(right));
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
        purpose: IGNORE_FILE_PURPOSES.prettier,
    });
}

/**
 * List the globs that a tool leaves out: the shared ignore sections, then the path ignores of one check.
 * @param session the repository to read.
 * @param view the settings of the scope.
 * @param check the ID whose path ignores to add.
 * @returns the globs, each once.
 */
function listIgnoredGlobs(session: Session, view: ScopeView, check: string): string[] {
    return buildGlobSections([...buildIgnoreSections(session), ...buildSettingsSections(view, check)]);
}

export { listIgnoredGlobs, buildGlobSections, buildIgnoreSections, buildPrettierignore, buildSettingsSections };
