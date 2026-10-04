// The tool configuration a configuration replaces: the file or section each tool owns, found among the tracked files.
import { readText } from '#cli/platform/source.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import { surveyRepository } from '#cli/repository/survey.ts';
import { hasToolSection } from '#cli/parsers/tool/configuration.ts';
import type { ManifestSummary } from '#cli/types/parsers/packages.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { isGlob, pathMatcher, isPrivateToolPath } from '#cli/repository/selectors.ts';
import type { Tooling, ToolFile, TrackedFile } from '#cli/types/repository/inventory.ts';

function hasSection(root: string, path: string, replace: NonNullable<ToolPin['replace']>[number]): boolean {
    const source = readText(root, path);
    if (source === undefined) return false;
    if (replace.table === undefined && replace.key === undefined) return true;
    return hasToolSection(source, path, replace);
}

// The tool configurations one replace row finds among the tracked files.
function getReplacedConfigs(
    root: string,
    inventory: Set<string>,
    tool: string,
    replace: NonNullable<ToolPin['replace']>[number],
): ToolFile[] {
    const matches = pathMatcher([replace.file, `**/${replace.file}`]);
    const candidates = new Set(inventory);
    if (!isGlob(replace.file) && !candidates.has(replace.file) && readText(root, replace.file) !== undefined)
        candidates.add(replace.file);
    return [...candidates]
        .filter((candidate) => matches(candidate))
        .filter((path) => hasSection(root, path, replace))
        .map((path) => ({
            tool,
            path,
            shared: replace.shared,
            ...(replace.table === undefined ? {} : { table: replace.table }),
            ...(replace.key === undefined ? {} : { key: replace.key }),
        }));
}

/**
 * Discover configuration sections declared by the tools that own them.
 * @param root the repository root
 * @param paths the tracked file paths
 * @returns tool configurations with their containing files and sections
 */
function getToolConfigs(root: string, paths: Iterable<string>): ToolFile[] {
    const inventory = new Set([...paths].filter((path) => !isPrivateToolPath(path)));
    return [...configurationManifests().values()].flatMap((manifest) =>
        manifest.tools.flatMap((tool) =>
            (tool.replace ?? []).flatMap((replace) => getReplacedConfigs(root, inventory, tool.name, replace)),
        ),
    );
}

/**
 * Whether a selected configuration declares that the generated configuration replaces the tool's own file.
 * @param tool the tool a configuration file belongs to
 * @param selected the ids of the selected configurations
 * @returns whether init replaces the tool's configuration
 */
export function isReplaced(tool: string, selected: Set<string>): boolean {
    const manifests = configurationManifests();
    return [...selected].some(
        (id) => manifests.get(id)?.tools.some((entry) => entry.name === tool && entry.replace !== undefined) === true,
    );
}

/**
 * Find the tool configuration the configurations replace, with the hooks, CI, agent files, lint folders, and runner found.
 * @param root the repository root
 * @param files the tracked files
 * @param fields the manifests read from the tree
 * @returns the configuration files, hooks, CI, agent files, lint folders, and runner found
 */
export function getTooling(root: string, files: TrackedFile[], fields: ManifestSummary[]): Tooling {
    const configurations = getToolConfigs(
        root,
        files.filter((file) => file.kind === 'source').map((file) => file.path),
    );
    return {
        configs: [
            ...new Map(
                configurations.map((entry) => [
                    JSON.stringify([entry.tool, entry.path, entry.table, entry.key]),
                    entry,
                ]),
            ).values(),
        ],
        ...surveyRepository(root, files, fields),
    };
}
