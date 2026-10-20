import picomatch from 'picomatch';
import { parse as parseYaml } from 'yaml';
import { posix, extname } from 'node:path';
import { isRecord } from '#cli/system/values.ts';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { readText } from '#cli/system/files/reads.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import type { Manifest } from '#cli/types/configurations.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { findProjectFolder } from '#cli/repository/scopes.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import type { TrackedFile, FoundToolFile } from '#cli/types/repository/inventory.ts';
import { INI_EXTENSIONS, YAML_EXTENSIONS } from '#cli/config/repository/existing-tools.ts';

// A dotfile such as .prettierrc.json applies in any folder. A plain name such as knip.ts counts only at the root of a
// project, because a source file deeper in the code can share it.
function listProjectFolders(inventory: Set<string>, manifests: Manifest[]): Set<string> {
    const patterns = manifests.flatMap((manifest) => manifest.detect.project_files);
    const folders = new Set(['']);
    for (const path of inventory)
        for (const pattern of patterns) {
            const folder = findProjectFolder(path, pattern);
            if (folder !== undefined) folders.add(folder);
        }
    return folders;
}

function findReplacedToolFiles(
    root: string,
    files: { inventory: Set<string>; projectFolders: Set<string> },
    tool: string,
    replacement: Pick<FoundToolFile, 'path' | 'shared' | 'key' | 'table'>,
): FoundToolFile[] {
    const { inventory, projectFolders } = files;
    const depth = replacement.path.split('/').length;
    const isDotfile = posix.basename(replacement.path).startsWith('.');
    const matches = buildPathMatcher([replacement.path, `**/${replacement.path}`]);
    const candidates = new Set(inventory);
    if (
        !picomatch.scan(replacement.path).isGlob &&
        !candidates.has(replacement.path) &&
        readText(root, replacement.path) !== undefined
    )
        candidates.add(replacement.path);
    return [...candidates]
        .filter(
            (candidate) =>
                matches(candidate) &&
                (isDotfile || projectFolders.has(candidate.split('/').slice(0, -depth).join('/'))),
        )
        .filter((path) => {
            const source = readText(root, path);
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
    if (YAML_EXTENSIONS.includes(extension)) return parseYaml(text) as unknown;
    if (extension === '.toml') return parseToml(text);
    throw new Error(`${path}: shared configuration format is unsupported.`);
}

function hasToolSection(text: string, path: string, selector: Pick<FoundToolFile, 'key' | 'table'>): boolean {
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
 * @param manifests the configurations whose tools name their settings files.
 * @returns each settings file with its tool, and whether it shares the file with other settings.
 */
export function listToolSettingsFiles(
    repositoryRoot: string,
    files: TrackedFile[],
    manifests: Iterable<Manifest>,
): FoundToolFile[] {
    const inventory = new Set(
        files.filter((file) => file.kind === 'source' && !isInGspotFolder(file.path)).map((file) => file.path),
    );
    const configurations = [...manifests];
    const located = { inventory, projectFolders: listProjectFolders(inventory, configurations) };
    return configurations.flatMap((manifest) =>
        manifest.tools.flatMap((tool) =>
            [
                ...(tool.replace ?? []).map((path) => ({ path, shared: false })),
                ...(tool.replace_key ?? []).map(({ file, ...selector }) => ({ path: file, shared: true, ...selector })),
            ].flatMap((replacement) => findReplacedToolFiles(repositoryRoot, located, tool.name, replacement)),
        ),
    );
}

/**
 * Find one INI section or its colon-delimited subsections.
 *
 * @param text the file contents.
 * @param section the INI heading to match, including colon-delimited subsections.
 * @returns true when a matching bracketed heading starts a line.
 */
export function hasIniSection(text: string, section: string): boolean {
    const header = new RegExp(String.raw`^\s*\[${RegExp.escape(section)}(?::[^\]]+)?\]\s*(?:[#;].*)?$`, 'mu');
    return header.test(text);
}
