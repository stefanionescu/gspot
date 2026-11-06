import { extname, posix } from 'node:path';

import picomatch from 'picomatch';

import { INI_EXTENSIONS, JSON_EXTENSION, TOML_EXTENSION, YAML_EXTENSIONS } from '#cli/config/repository/setup.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { listProjectFolders } from '#cli/repository/scopes.ts';
import { tryParseFile } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { isTable } from '#cli/system/tables.ts';
import { escapeRegExp } from '#cli/system/text.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { ConflictingConfig, ManagedKeys, TrackedFile } from '#cli/types/repository.ts';

function listReplacementConflicts(root: string, paths: string[], replacement: ConflictingConfig): ConflictingConfig[] {
    return paths
        .filter((path) => {
            const source = findText(root, path);
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
            ...(replacement.pointer === true && { pointer: true }),
        }));
}

function listConfigurationConflicts(
    root: string,
    configuration: Configuration,
    files: { inventory: Set<string>; projectFolders: Set<string> },
): ConflictingConfig[] {
    const replacements = configuration.tools.flatMap((tool) => [
        ...(tool.replace ?? []).map((path) => ({ tool: tool.name, path, shared: false })),
        ...(tool.replace_key ?? []).map(({ file, ...selector }) => ({
            tool: tool.name,
            path: file,
            shared: true,
            ...selector,
        })),
    ]);
    return replacements.flatMap((replacement) => {
        const isReplacedPath = buildPathMatcher([replacement.path, `**/${replacement.path}`]);
        // A manifest names a config that cascades below the project roots with a leading dot.
        const isCascading = posix.basename(replacement.path).startsWith('.');
        const paths = [...files.inventory].filter(
            (path) => isReplacedPath(path) && (isCascading || files.projectFolders.has(posix.dirname(path))),
        );
        const isRootOnly =
            !picomatch.scan(replacement.path).isGlob &&
            !files.inventory.has(replacement.path) &&
            findText(root, replacement.path) !== undefined;
        return listReplacementConflicts(root, [...paths, ...(isRootOnly ? [replacement.path] : [])], replacement);
    });
}

export function parseSharedFile(text: string, extension: string, path: string): unknown {
    if (extension === JSON_EXTENSION) return parseJsonFile(path, text);
    if (YAML_EXTENSIONS.includes(extension)) return parseYamlFile(path, text);
    if (extension === TOML_EXTENSION) return parseTomlFile(path, text);
    throw new Error(`${path}: gspot cannot read the settings format of this shared file.`);
}

export function hasToolSection(
    text: string,
    path: string,
    selector: Pick<ConflictingConfig, 'key' | 'table'>,
): boolean {
    const extension = extname(path);
    if (selector.table !== undefined && INI_EXTENSIONS.has(extension)) {
        const header = new RegExp(String.raw`^\s*\[${escapeRegExp(selector.table)}(?::[^\]]+)?\]\s*(?:[#;].*)?$`, 'mu');
        return header.test(text);
    }
    const segments = selector.key === undefined ? (selector.table as string).split('.') : [selector.key];
    let value = tryParseFile(() => parseSharedFile(text, extension, path));
    for (const segment of segments) {
        if (!isTable(value) || !Object.hasOwn(value, segment)) return false;
        value = value[segment];
    }
    return true;
}

export function listConflictingConfigs(
    root: string,
    files: TrackedFile[],
    configurations: Iterable<Configuration>,
): ConflictingConfig[] {
    const inventory = new Set(
        files.filter((file) => file.kind === 'source' && !isGspotPath(file.path)).map((file) => file.path),
    );
    const selected = [...configurations];
    const located = { inventory, projectFolders: new Set(['.', ...listProjectFolders(inventory, selected)]) };
    return selected.flatMap((configuration) => listConfigurationConflicts(root, configuration, located));
}

export function isEditedInPlace(config: ConflictingConfig, fileEdits: ManagedKeys[]): boolean {
    return fileEdits.some(
        (output) => output.path === config.path && output.keys.some((field) => field.key[0] === config.key),
    );
}
