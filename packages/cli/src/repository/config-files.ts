import picomatch from 'picomatch';
import { posix, extname } from 'node:path';
import { isTable } from '#cli/system/tables.ts';
import { findText } from '#cli/system/files/reads.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { listProjectFolders } from '#cli/repository/scopes.ts';
import { YAML_EXTENSIONS } from '#cli/config/repository/setup.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import { INI_EXTENSIONS } from '#cli/config/repository/config-files.ts';
import type { ConflictingConfigFile } from '#cli/types/repository/setup.ts';

function findConflictingConfigFiles(
    root: string,
    files: { inventory: Set<string>; projectFolders: Set<string> },
    tool: string,
    replacement: Pick<ConflictingConfigFile, 'path' | 'shared' | 'key' | 'table'>,
): ConflictingConfigFile[] {
    const { inventory, projectFolders } = files;
    const depth = replacement.path.split('/').length;
    const isDotfile = posix.basename(replacement.path).startsWith('.');
    const matches = buildPathMatcher([replacement.path, `**/${replacement.path}`]);
    const paths = new Set(inventory);
    if (
        !picomatch.scan(replacement.path).isGlob &&
        !paths.has(replacement.path) &&
        findText(root, replacement.path) !== undefined
    )
        paths.add(replacement.path);
    return [...paths]
        .filter(
            (path) => matches(path) && (isDotfile || projectFolders.has(path.split('/').slice(0, -depth).join('/'))),
        )
        .filter((path) => {
            const source = findText(root, path);
            if (source === undefined) return false;
            return (
                (replacement.table === undefined && replacement.key === undefined) ||
                hasToolSection(source, path, replacement)
            );
        })
        .map((path) => ({
            tool,
            path,
            shared: replacement.shared,
            ...(replacement.table !== undefined && { table: replacement.table }),
            ...(replacement.key !== undefined && { key: replacement.key }),
        }));
}

function parseSharedFile(text: string, extension: string, path: string): unknown {
    if (extension === '.json') return parseJsonFile(path, text);
    if (YAML_EXTENSIONS.includes(extension)) return parseYamlFile(path, text);
    if (extension === '.toml') return parseTomlFile(path, text);
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

@param repositoryRoot the repository to read.
@param files the tracked inventory.
@param configurations the configurations whose tools name their settings files.
@returns each settings file with its tool, and whether it shares the file with other settings.
*/
export function listConflictingConfigFiles(
    repositoryRoot: string,
    files: TrackedFile[],
    configurations: Iterable<Configuration>,
): ConflictingConfigFile[] {
    const inventory = new Set(
        files
            .filter((file) => file.kind === 'source' && !file.path.startsWith(`${DOT_GSPOT}/`))
            .map((file) => file.path),
    );
    const selected = [...configurations];
    const located = { inventory, projectFolders: new Set(['', ...listProjectFolders(inventory, selected)]) };
    return selected.flatMap((configuration) =>
        configuration.tools.flatMap((tool) =>
            [
                ...(tool.replace ?? []).map((path) => ({ path, shared: false })),
                ...(tool.replace_key ?? []).map(({ file, ...selector }) => ({ path: file, shared: true, ...selector })),
            ].flatMap((replacement) => findConflictingConfigFiles(repositoryRoot, located, tool.name, replacement)),
        ),
    );
}
