// The entry files of a folder: what the settings declares for it, then what the configurations of the deepest scope around it know.

import type { Session } from '#cli/types/planning.ts';
import { joinScopeSelector } from '#cli/settings/paths.ts';
import { listPointerPaths } from '#cli/generation/pointers.ts';
import { listApplicableTables } from '#cli/settings/inherit.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { listWorkspaceFolders } from '#cli/tools/npm/packages.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import type { GenerationInputs } from '#cli/types/generation/files.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import type { Settings, ScopeSelection } from '#cli/types/settings/values.ts';
import { generatedIgnores, selectedIgnorePaths } from '#cli/generation/ignore-files.ts';

import {
    KNIP_IGNORED,
    KNIP_SCHEMA_URL,
    KNIP_ENTRY_SETTING,
    KNIP_IGNORED_DEPENDENCIES,
    KNIP_JAVASCRIPT_ENTRY_FILES,
} from '#cli/config/generation/tool-file-sources.ts';

/**
 * Select your own and declared entry files for their effective scope.
 *
 * @param settings your settings.
 * @param scopes the effective selections.
 * @param scope the owning path.
 *
 * @returns entry patterns for each scope.
 */
function selectEntryFiles(settings: Settings, scopes: ScopeSelection[], scope: string): string[] {
    const authored = listApplicableTables(settings, scope).flatMap(({ table }) => {
        const entries = table.tools?.['knip']?.[KNIP_ENTRY_SETTING];
        return Array.isArray(entries) ? entries.filter((entry): entry is string => typeof entry === 'string') : [];
    });
    const declared = scopes
        .filter((entry) => isInScope(scope, entry.scope.path))
        .toSorted((left, right) => compareScopeDepth(right.scope.path, left.scope.path))
        .slice(0, 1)
        .flatMap(({ selected, view }) => [
            ...(selected.some((manifest) => manifest.configuration.name === 'javascript')
                ? KNIP_JAVASCRIPT_ENTRY_FILES
                : []
            ).map((pattern) => joinScopeSelector(pattern, scope)),
            ...view.test_files,
        ]);
    return [...new Set([...authored, ...declared])].flatMap((pattern) => {
        const sign = pattern.startsWith('!') ? '!' : '';
        const source = sign === '' ? pattern : pattern.slice(1);
        if (scope === '' || source.startsWith('**/')) return [pattern];
        return source.startsWith(`${scope}/`) ? [`${sign}${source.slice(scope.length + 1)}`] : [];
    });
}

/**
 * Build native Knip workspace entries and scoped dependency exclusions.
 *
 * @param root the repository root.
 * @param settings the validated settings.
 * @param scopes the selected project scopes.
 *
 * @returns the native workspace settings.
 */
function buildWorkspaces(root: string, settings: Settings, scopes: ScopeSelection[]) {
    const selected = scopes.filter(({ view }) => view.configurations.includes('javascript'));
    const paths = [...new Set(['', ...listWorkspaceFolders(root)])];
    return Object.fromEntries(
        paths.map((path) => {
            const workspace = selected.find((entry) => entry.scope.path === path);
            const ignored = workspace?.view.options('tools.knip').ignore_dependencies;
            return [
                path === '' ? '.' : path,
                {
                    entry: selectEntryFiles(settings, scopes, path),
                    ...(path !== '' && ignored !== undefined ? { ignoreDependencies: ignored } : {}),
                },
            ];
        }),
    );
}

/**
 * Write the knip configuration from selected settings.
 *
 * @param input the source values.
 *
 * @returns the generated configuration text.
 */
export function buildKnipFile(
    input: Pick<GenerationInputs, 'selection' | 'scopes' | 'files' | 'manifests'> &
        Pick<Session, 'root' | 'settingsFile' | 'reads' | 'repository' | 'startRunner'>,
): string {
    const { selection, scopes, files, manifests, settingsFile, root, startRunner } = input;
    const { ignoresFor, extra } = selection.view;
    const options = selection.view.options('tools.knip');
    const scanner = selection.view.options('dependencies').scanner;
    const ignoredPaths = [
        ...generatedIgnores(input),
        ...selectedIgnorePaths(scopes).filter((path) => !path.endsWith('/')),
    ];
    const pointers = scopes.flatMap((selection) =>
        selection.selected.flatMap((manifest) =>
            manifest.toolFiles.flatMap((toolFile) =>
                listPointerPaths({ files, selection, manifest, scopes }, toolFile),
            ),
        ),
    );
    const tools = listDistinctTools(manifests);
    const toolBinaries = [
        ...tools.filter((tool) => tool.kind !== 'library').map((tool) => tool.name),
        startRunner.name,
    ];
    const toolPackages = tools.flatMap((tool) =>
        tool.installers['npm']?.name === undefined ? [] : [tool.installers['npm'].name],
    );
    const workspaces = buildWorkspaces(root, settingsFile.settings, scopes);
    return JSON.stringify(
        {
            $schema: KNIP_SCHEMA_URL,
            ignore: [
                ...new Set([
                    ...KNIP_IGNORED,
                    ...pointers,
                    ...ignoresFor('javascript/knip')
                        .filter((entry) => entry.rule === undefined)
                        .flatMap((entry) => entry.paths),
                    ...ignoredPaths,
                ]),
            ],
            ignoreDependencies: [
                ...new Set([
                    ...KNIP_IGNORED_DEPENDENCIES,
                    ...toolPackages,
                    ...(scanner === undefined ? [] : [scanner]),
                    ...options.ignore_dependencies,
                ]),
            ],
            ignoreBinaries: [...new Set(toolBinaries)],
            ignoreExportsUsedInFile: settingsFile.settings.level !== 'all',
            workspaces,
            ...extra('knip'),
        },
        null,
        JSON_INDENT,
    );
}
