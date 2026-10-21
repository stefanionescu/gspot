import picomatch from 'picomatch';
import { posix, extname } from 'node:path';
import { isRecord } from '#cli/system/tables.ts';
import { hasIniSection } from '#cli/parsers/ini.ts';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { parseYamlFile } from '#cli/parsers/yaml.ts';
import { findText } from '#cli/system/files/reads.ts';
import { parseTomlFile } from '#cli/parsers/toml/document.ts';
import { findProjectFolder } from '#cli/repository/scopes.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { isInGspotFolder } from '#cli/repository/files/tool-folders.ts';
import type { ReplacedFile } from '#cli/types/repository/existing-tools.ts';
import { INI_EXTENSIONS, YAML_EXTENSIONS } from '#cli/config/repository/existing-tools.ts';

// A dotfile such as .prettierrc.json applies in any folder. A plain name such as knip.ts counts only at the root of a
// project, because a source file deeper in the code can share it.
function listProjectFolders(inventory: Set<string>, configurations: Configuration[]): Set<string> {
    const patterns = configurations.flatMap((configuration) => configuration.detect.project_files);
    const folders = new Set(['']);
    for (const path of inventory)
        for (const pattern of patterns) {
            const folder = findProjectFolder(path, pattern);
            if (folder !== undefined) folders.add(folder);
        }
    return folders;
}

function findReplacedFiles(
    root: string,
    files: { inventory: Set<string>; projectFolders: Set<string> },
    tool: string,
    replacement: Pick<ReplacedFile, 'path' | 'shared' | 'key' | 'table'>,
): ReplacedFile[] {
    const { inventory, projectFolders } = files;
    const depth = replacement.path.split('/').length;
    const isDotfile = posix.basename(replacement.path).startsWith('.');
    const matches = buildPathMatcher([replacement.path, `**/${replacement.path}`]);
    const candidates = new Set(inventory);
    if (
        !picomatch.scan(replacement.path).isGlob &&
        !candidates.has(replacement.path) &&
        findText(root, replacement.path) !== undefined
    )
        candidates.add(replacement.path);
    return [...candidates]
        .filter(
            (candidate) =>
                matches(candidate) &&
                (isDotfile || projectFolders.has(candidate.split('/').slice(0, -depth).join('/'))),
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
            ...(replacement.table === undefined ? {} : { table: replacement.table }),
            ...(replacement.key === undefined ? {} : { key: replacement.key }),
        }));
}

function parseSharedFile(text: string, extension: string, path: string): unknown {
    if (extension === '.json') return parseJsonFile(path, text);
    if (YAML_EXTENSIONS.includes(extension)) return parseYamlFile(path, text);
    if (extension === '.toml') return parseTomlFile(path, text);
    throw new Error(`${path}: shared configuration format is unsupported.`);
}

function hasToolSection(text: string, path: string, selector: Pick<ReplacedFile, 'key' | 'table'>): boolean {
    const extension = extname(path);
    if (selector.table !== undefined && INI_EXTENSIONS.has(extension)) return hasIniSection(text, selector.table);
    const parts = selector.key === undefined ? (selector.table as string).split('.') : [selector.key];
    let value = parseSharedFile(text, extension, path);
    for (const part of parts) {
        if (!isRecord(value) || !Object.hasOwn(value, part)) return false;
        value = value[part];
    }
    return true;
}

/**
 * Find the settings files of the tools that gspot writes settings for, such as .commitlintrc.json for commitlint.
 *
 * @param repositoryRoot the repository to read.
 * @param files the tracked inventory.
 * @param configurations the configurations whose tools name their settings files.
 * @returns each settings file with its tool, and whether it shares the file with other settings.
 */
export function listReplacedFiles(
    repositoryRoot: string,
    files: TrackedFile[],
    configurations: Iterable<Configuration>,
): ReplacedFile[] {
    const inventory = new Set(
        files.filter((file) => file.kind === 'source' && !isInGspotFolder(file.path)).map((file) => file.path),
    );
    const selected = [...configurations];
    const located = { inventory, projectFolders: listProjectFolders(inventory, selected) };
    return selected.flatMap((configuration) =>
        configuration.tools.flatMap((tool) =>
            [
                ...(tool.replace ?? []).map((path) => ({ path, shared: false })),
                ...(tool.replace_key ?? []).map(({ file, ...selector }) => ({ path: file, shared: true, ...selector })),
            ].flatMap((replacement) => findReplacedFiles(repositoryRoot, located, tool.name, replacement)),
        ),
    );
}
