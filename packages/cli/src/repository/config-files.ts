import picomatch from 'picomatch';
import { posix, extname } from 'node:path';
import { isTable } from '#cli/system/tables.ts';
import { find } from '#cli/system/files/reads.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { listProjectFolders } from '#cli/repository/scopes.ts';
import { YAML_EXTENSIONS } from '#cli/config/repository/setup.ts';
import { TOML_EXTENSION } from '#cli/config/repository/writer.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import type { ManagedKeys } from '#cli/types/repository/writer.ts';
import type { ConflictingConfigFile } from '#cli/types/repository/setup.ts';
import { JSON_EXTENSION, INI_EXTENSIONS } from '#cli/config/repository/config-files.ts';

function listReplacementConflicts(
    root: string,
    paths: string[],
    replacement: ConflictingConfigFile,
): ConflictingConfigFile[] {
    return paths
        .filter((path) => {
            const source = find(root, path);
            if (source === undefined) return false;
            return (
                (replacement.table === undefined && replacement.key === undefined) ||
                hasToolSection(source, path, replacement)
            );
        })
        .map((path) => ({
            tool: replacement.tool,
            path,
            shared: replacement.shared,
            ...(replacement.table !== undefined && { table: replacement.table }),
            ...(replacement.key !== undefined && { key: replacement.key }),
        }));
}

function listConfigurationConflicts(
    root: string,
    configuration: Configuration,
    files: { inventory: Set<string>; projectFolders: Set<string> },
): ConflictingConfigFile[] {
    const replacements = configuration.tools.flatMap((tool) =>
        [
            ...(tool.replace ?? []).map((path) => ({ tool: tool.name, path, shared: false })),
            ...(tool.replace_key ?? []).map(({ file, ...selector }) => ({
                tool: tool.name,
                path: file,
                shared: true,
                ...selector,
            })),
        ].map((replacement) => ({
            replacement,
            paths: [] as string[],
            depth: replacement.path.split('/').length,
            isDotfile: posix.basename(replacement.path).startsWith('.'),
            matches: buildPathMatcher([replacement.path, `**/${replacement.path}`]),
        })),
    );
    for (const path of files.inventory) {
        for (const replacement of replacements) {
            if (
                replacement.matches(path) &&
                (replacement.isDotfile ||
                    files.projectFolders.has(path.split('/').slice(0, -replacement.depth).join('/')))
            )
                replacement.paths.push(path);
        }
    }
    return replacements.flatMap(({ replacement, paths }) => {
        if (
            !picomatch.scan(replacement.path).isGlob &&
            !files.inventory.has(replacement.path) &&
            find(root, replacement.path) !== undefined
        )
            paths.push(replacement.path);
        return listReplacementConflicts(root, paths, replacement);
    });
}

function parseSharedFile(text: string, extension: string, path: string): unknown {
    if (extension === JSON_EXTENSION) return parseJsonFile(path, text);
    if (YAML_EXTENSIONS.includes(extension)) return parseYamlFile(path, text);
    if (extension === TOML_EXTENSION) return parseTomlFile(path, text);
    throw new Error(`${path}: gspot cannot read the settings format of this shared file.`);
}

function hasToolSection(text: string, path: string, selector: Pick<ConflictingConfigFile, 'key' | 'table'>): boolean {
    const extension = extname(path);
    if (selector.table !== undefined && INI_EXTENSIONS.has(extension)) {
        const header = new RegExp(
            String.raw`^\s*\[${RegExp.escape(selector.table)}(?::[^\]]+)?\]\s*(?:[#;].*)?$`,
            'mu',
        );
        return header.test(text);
    }
    const segments = selector.key === undefined ? (selector.table as string).split('.') : [selector.key];
    let value = parseSharedFile(text, extension, path);
    for (const segment of segments) {
        if (!isTable(value) || !Object.hasOwn(value, segment)) return false;
        value = value[segment];
    }
    return true;
}

/**
Find the settings files of the tools that gspot writes settings for, such as .commitlintrc.json for commitlint.

@param root the repository to read.
@param files the tracked inventory.
@param configurations the configurations whose tools name their settings files.
*/
export function listConflictingConfigFiles(
    root: string,
    files: TrackedFile[],
    configurations: Iterable<Configuration>,
): ConflictingConfigFile[] {
    const inventory = new Set(
        files
            .filter((file) => file.kind === 'source' && !file.path.startsWith(`${GSPOT_FOLDER}/`))
            .map((file) => file.path),
    );
    const selected = [...configurations];
    const located = { inventory, projectFolders: new Set(['', ...listProjectFolders(inventory, selected)]) };
    return selected.flatMap((configuration) => listConfigurationConflicts(root, configuration, located));
}

/**
Check whether generated field edits cover an existing tool settings section.

@param configFile the existing file or section.
@param fileEdits the generated field edits.
*/
export function isEditedInPlace(configFile: ConflictingConfigFile, fileEdits: ManagedKeys[]): boolean {
    return fileEdits.some(
        (output) => output.path === configFile.path && output.keys.some((field) => field.key[0] === configFile.key),
    );
}
