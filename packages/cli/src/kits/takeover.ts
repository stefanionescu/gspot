// The tool configuration a kit replaces: the file or section each tool owns, found among the tracked files.
import picomatch from 'picomatch';
import { extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import type { ToolPin } from '#cli/types/kits.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { parseJsonc } from '#cli/repository/jsonc.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Root } from '#cli/types/platform/platform.ts';
import { surveyRepository } from '#cli/repository/survey.ts';
import { DOT_GSPOT } from '#cli/config/repository/repository.ts';
import type { Fields, Tooling, ToolFile, TrackedFile } from '#cli/types/repository/repository.ts';

const PARSERS: Record<string, (text: string) => unknown> = {
    '.json': (text) => JSON.parse(text) as unknown,
    '.jsonc': parseJsonc,
    '.json5': parseJsonc,
    '.yaml': parseYaml,
    '.yml': parseYaml,
    '.toml': parseToml,
};

function selectedValue(value: unknown, selector: Parameters<typeof kitSection>[2]): { parsed: unknown } | undefined {
    const parts = selector.key === undefined ? (selector.table?.split('.') ?? []) : [selector.key];
    let parsed = value;
    for (const part of parts) {
        if (typeof parsed !== 'object' || parsed === null || !Object.hasOwn(parsed, part)) return undefined;
        parsed = (parsed as Record<string, unknown>)[part];
    }
    return { parsed };
}

function sectionName(line: string): string | undefined {
    const trimmed = line.trim();
    const close = trimmed.indexOf(']');
    const tail = close === -1 ? '' : trimmed.slice(close + 1).trim();
    const isHeader =
        trimmed.startsWith('[') && close > 1 && (tail === '' || tail.startsWith('#') || tail.startsWith(';'));
    return isHeader ? trimmed.slice(1, close) : undefined;
}

/**
 * Select an owned key or table while keeping the shared document available for exact recovery.
 * @param text the file text.
 * @param path the file path, whose extension names the format.
 * @param selector the key or table the tool owns.
 * @param selector.key the top-level key.
 * @param selector.table the table.
 * @returns the section's text and parsed value, or undefined when the file has none.
 */
function kitSection(
    text: string,
    path: string,
    selector: { key?: string; table?: string },
): { text: string; parsed: unknown } | undefined {
    const extension = extname(path);
    if (selector.table !== undefined && (extension === '.ini' || extension === '.cfg')) {
        const selected = iniSection(text, selector.table);
        return selected === undefined ? undefined : { text: selected, parsed: {} };
    }
    const parse = PARSERS[extension];
    if (parse === undefined) throw new Error(`${path}: shared configuration format is unsupported.`);
    const selected = selectedValue(parse(text), selector);
    return selected === undefined ? undefined : { text, ...selected };
}

function hasConfigurationSection(files: Root, path: string, replace: NonNullable<ToolPin['replace']>[number]): boolean {
    if (replace.table === undefined && replace.key === undefined) return true;
    const source = files.read(path);
    if (source === undefined) return false;
    return (
        kitSection(source.bytes.toString('utf8'), path, {
            ...(replace.table === undefined ? {} : { table: replace.table }),
            ...(replace.key === undefined ? {} : { key: replace.key }),
        }) !== undefined
    );
}

// The tool configurations one replace row finds among the tracked files.
function replaceTools(
    files: Root,
    inventory: Set<string>,
    tool: string,
    replace: NonNullable<ToolPin['replace']>[number],
): ToolFile[] {
    const matches = pathMatcher([replace.file, `**/${replace.file}`]);
    const candidates = new Set(inventory);
    if (!picomatch.scan(replace.file).isGlob && !candidates.has(replace.file) && files.stat(replace.file) !== undefined)
        candidates.add(replace.file);
    return [...candidates]
        .filter((candidate) => matches(candidate))
        .filter((path) => hasConfigurationSection(files, path, replace))
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
function declaredKits(root: string, paths: Iterable<string>): ToolFile[] {
    const inventory = new Set(
        [...paths].filter((path) => !path.split('/').some((part) => part.toLowerCase() === DOT_GSPOT)),
    );
    using files = openRoot(root);
    return [...kitManifests().values()].flatMap((manifest) =>
        manifest.tools.flatMap((tool) =>
            (tool.replace ?? []).flatMap((replace) => replaceTools(files, inventory, tool.name, replace)),
        ),
    );
}

/**
 * Select one INI section and its colon-delimited subsections without changing their text.
 * @param text the INI text
 * @param section the section name
 * @returns the section text, or undefined when the file has no such section
 */
export function iniSection(text: string, section: string): string | undefined {
    const seen = new Set<string>();
    let included = false;
    const selected = text.split('\n').flatMap((line) => {
        const header = sectionName(line);
        if (header === undefined) return included ? [line] : [];
        included = header === section || header.startsWith(`${section}:`);
        if (!included) return [];
        if (seen.has(header)) throw new Error(`Duplicate configuration section: ${header}`);
        seen.add(header);
        return [line];
    });
    return selected.length === 0 ? undefined : selected.join('\n');
}

/**
 * Whether a selected kit declares that the generated configuration replaces the tool's own file.
 * @param tool the tool a configuration file belongs to
 * @param selected the ids of the selected kits
 * @returns whether init replaces the tool's configuration
 */
export function isOwned(tool: string, selected: Set<string>): boolean {
    const manifests = kitManifests();
    return [...selected].some(
        (id) => manifests.get(id)?.tools.some((entry) => entry.name === tool && entry.replace !== undefined) === true,
    );
}

/**
 * Find the tool configuration the kits replace, with the hooks, CI, agent files, lint folders, and runner found.
 * @param root the repository root
 * @param files the tracked files
 * @param fields the manifests read from the tree
 * @returns the configuration files, hooks, CI, agent files, lint folders, and runner found
 */
export function existingTooling(root: string, files: TrackedFile[], fields: Fields[]): Tooling {
    const configurations = declaredKits(
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
