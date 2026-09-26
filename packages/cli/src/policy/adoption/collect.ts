import { z } from 'zod';
import { dirname } from 'node:path';
import { osvImporter } from '#cli/policy/adoption/osv.ts';
import { ruffImporter } from '#cli/policy/adoption/ruff.ts';
import { typosImporter } from '#cli/policy/adoption/typos.ts';
import { collectEslint } from '#cli/policy/adoption/eslint.ts';
import { appendSetting } from '#cli/policy/adoption/results.ts';
import { gitleaksImporter } from '#cli/policy/adoption/gitleaks.ts';
import { licensesImporter } from '#cli/policy/adoption/licenses.ts';
import { stylelintImporter } from '#cli/policy/adoption/stylelint.ts';
import { collectFormatting } from '#cli/policy/adoption/formatting.ts';
import { markdownImporter } from '#cli/policy/adoption/markdownlint.ts';
import { ignoreFileEntries } from '#cli/policy/adoption/ignore-files.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { IGNORE_PATH_KEYS, SEPARATE_TOOLS } from '#cli/constants/policy/adoption.ts';
import { observeConfiguration, parseCarrySource } from '#cli/policy/adoption/source.ts';
import type { ExistingTool, ExistingTooling } from '#cli/types/repository/repository.ts';
import { carryDisabled, carryPyright, valueOfKeyLine } from '#cli/policy/adoption/disabled.ts';
import type { Carrier, Owned, CarriedConfiguration, CarrySource } from '#cli/types/policy/adoption.ts';

const strings = z.array(z.string());

// The importer a manifest's reader kind selects, whatever tool declares it.
const READER_CARRIERS: Record<string, Carrier | undefined> = {
    words: typosImporter.carry,
    advisories: osvImporter.carry,
    licenses: licensesImporter.carry,
};
// Refuses a ShellCheck configuration with any line other than a disable directive or a comment.
function assertShellcheckSupported(source: CarrySource, path: string): void {
    const unsupported = source.text.split('\n').find((line) => {
        const content = line.trim();
        return content !== '' && !content.startsWith('#') && valueOfKeyLine(line, 'disable') === undefined;
    });
    if (unsupported !== undefined)
        throw new Error(`${path}: unsupported configuration line ${JSON.stringify(unsupported)}.`);
}

// Refuses a configuration the tool's importer cannot carry in full.
function assertSupported(source: CarrySource, tool: string, path: string): void {
    if (tool === 'shellcheck') assertShellcheckSupported(source, path);
    else assertImportable(source, tool, path);
}

// Refuses a configuration with settings the tool's importer does not carry.
function assertImportable(source: CarrySource, tool: string, path: string): void {
    const schema = nativeImporters[tool]?.schema;
    if (schema === undefined) throw new Error(`${path}: no complete ${tool} configuration importer is available.`);
    const parsed = schema.safeParse(source.parsed);
    if (parsed.success) return;
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`${path}: unsupported settings: ${issues}`);
}

/**
 * Reads what one old configuration file holds that gspot keeps: exception lists for the four list tools, disabled rules for the rest.
 * @param source the input already read and parsed
 * @param tool the tool the file configures
 * @param path the file, relative to the root
 * @param lists the lists the entries are added to
 * @param root the repository root
 * @param reader the kind of reading the tool's manifest declares for the file
 * @param check the check the carried ignores belong to
 */
async function carryFrom(
    source: CarrySource,
    tool: string,
    path: string,
    lists: CarriedConfiguration,
    root: string,
    reader: ExistingTool['carries'],
    check?: string,
): Promise<void> {
    if (reader === 'ignore-paths' && tool !== 'basedpyright') {
        const key = IGNORE_PATH_KEYS[tool];
        if (key === undefined) throw new Error(`${path}: no complete ${tool} ignore-path importer is available.`);
        appendSetting(lists, tool, key, ignoreFileEntries(source.text, path));
        return;
    }
    assertSupported(source, tool, path);
    const carry = READER_CARRIERS[reader] ?? nativeImporters[tool]?.carry;
    if (carry) await carry(source, path, lists, root, check);
    else carryDisabled(source, tool, path, lists, check);
}

// Whether another configuration of the same tool sits in or under the folder of this one.
function hasOverlap(entry: Owned, separate: Owned[]): boolean {
    const base = dirname(entry.path);
    return separate.some((other) => {
        if (other.tool !== entry.tool || other === entry) return false;
        const folder = dirname(other.path);
        return base === '.' || folder === base || folder.startsWith(`${base}/`);
    });
}

// Records each configuration that overlaps another of the same tool as unread.
function noteOverlaps(owned: Owned[], lists: CarriedConfiguration): void {
    const separate = owned.filter(({ tool }) => SEPARATE_TOOLS.has(tool));
    for (const entry of separate)
        if (hasOverlap(entry, separate))
            lists.unread.push({
                path: entry.path,
                note: `Overlapping ${entry.tool} configuration requires explicit conversion before adoption.`,
            });
}

// Captures every owned file before any executable configuration can change another tool's input.
function observeOwned(root: string, owned: Owned[], lists: CarriedConfiguration): void {
    for (const path of new Set(owned.map(({ path }) => path))) {
        try {
            lists.observed.set(path, observeConfiguration(root, path).original);
        } catch (error) {
            lists.unread.push({ path, note: `not read and not deleted: ${(error as Error).message}` });
        }
    }
}

// The table or key inside a shared file that holds the tool's settings, when the file is shared.
function selectorOf(entry: Owned): { table?: string; key?: string } | undefined {
    const { table, key } = entry;
    if (table === undefined && key === undefined) return undefined;
    return { ...(table === undefined ? {} : { table }), ...(key === undefined ? {} : { key }) };
}

// Records what takeover does with a carried file: keeps a shared file for the developer, removes an owned one.
function recordOutcome(entry: Owned, lists: CarriedConfiguration): void {
    const { tool, path, shared, table, key } = entry;
    if (shared === true)
        lists.retained.push({
            path,
            note: `${table ?? key ?? tool} settings are represented in gspot configuration; remove that section manually`,
        });
    else lists.removed.push({ path, note: `replaced by gspot's ${tool} configuration` });
}

// Carries one owned file, then records whether takeover removes it or a shared file keeps it.
async function carryOwned(root: string, entry: Owned, lists: CarriedConfiguration): Promise<void> {
    const { tool, path, carries, check } = entry;
    try {
        const observed = lists.observed.get(path);
        if (observed === undefined) throw new Error(`${path} was not observed in the repository.`);
        const source = parseCarrySource(observed, tool, path, selectorOf(entry));
        await carryFrom(source, tool, path, lists, root, carries, check);
    } catch (error) {
        lists.unread.push({ path, note: `not read and not deleted: ${(error as Error).message}` });
        return;
    }
    recordOutcome(entry, lists);
}

// Whether a formatter or ESLint importer reads the file, ahead of the per-tool carriers.
function isCarriedElsewhere(entry: Owned): boolean {
    return entry.tool === 'prettier' || entry.tool === 'ec' || entry.carries === 'eslint-config';
}

function sortedUnique(items: string[]): string[] {
    return [...new Set(items)].toSorted((a, b) => a.localeCompare(b));
}

export const nativeImporters: Record<
    string,
    {
        schema: z.ZodType;
        carry?: (
            source: CarrySource,
            path: string,
            lists: CarriedConfiguration,
            root: string,
            check?: string,
        ) => void | Promise<void>;
    }
> = {
    typos: typosImporter,
    gitleaks: gitleaksImporter,
    'osv-scanner': osvImporter,
    basedpyright: { schema: z.strictObject({ exclude: strings.optional() }), carry: carryPyright },
    'license-checker-rseidelsohn': licensesImporter,
    ruff: ruffImporter,
    'markdownlint-cli2': markdownImporter,
    stylelint: stylelintImporter,
    squawk: { schema: z.strictObject({ excluded_rules: strings.optional() }) },
    swiftlint: { schema: z.strictObject({ disabled_rules: strings.optional() }) },
    hadolint: { schema: z.strictObject({ ignored: strings.optional() }) },
    sqlfluff: {
        schema: z.strictObject({ sqlfluff: z.strictObject({ exclude_rules: z.string().optional() }).optional() }),
    },
};

/**
 * True when a selected configuration declares adoption for the tool.
 * @param tool the tool a configuration file belongs to
 * @param selected the ids of the selected configurations
 * @returns whether takeover replaces the tool's configuration
 */
export function isOwned(tool: string, selected: Set<string>): boolean {
    const manifests = configurationManifests();
    return [...selected].some(
        (id) => manifests.get(id)?.tools.some((entry) => entry.name === tool && entry.takeover !== undefined) === true,
    );
}

/**
 * Reads carried settings from each declared configuration of the selected tools. Deletes nothing.
 * @param root the repository root
 * @param tooling the configuration files, hooks and lint folders found
 * @param selected the ids of the selected configurations
 * @param paths the tracked source paths
 * @returns the lists to write into gspot.toml and the files takeover replaces
 */
export async function collectCarried(
    root: string,
    tooling: ExistingTooling,
    selected: Set<string>,
    paths: string[],
): Promise<CarriedConfiguration> {
    const lists: CarriedConfiguration = {
        observed: new Map(),
        tools: new Map(),
        scopes: new Map(),
        removed: [],
        unread: [],
        retained: [],
    };
    const owned = tooling.configs.filter(({ tool }) => isOwned(tool, selected));
    noteOverlaps(owned, lists);
    observeOwned(root, owned, lists);
    if (lists.unread.length > 0) return lists;
    await collectFormatting(
        root,
        owned.filter(({ tool }) => tool === 'prettier' || tool === 'ec'),
        lists,
    );
    await collectEslint(
        root,
        owned.filter(({ carries }) => carries === 'eslint-config'),
        paths,
        lists,
    );
    for (const entry of owned) if (!isCarriedElsewhere(entry)) await carryOwned(root, entry, lists);
    return lists;
}

/**
 * The delete-when-ready list: hook directories, lint folders, lint-only manifests, duplicate pins.
 * @param tooling the configuration files, hooks and lint folders found
 * @param duplicatePins the tools pinned both by gspot and elsewhere
 * @returns the paths with a note each
 */
export function noLongerRuns(
    tooling: ExistingTooling,
    duplicatePins: { tool: string; version: string; place: string }[],
): { path: string; note: string }[] {
    const list: { path: string; note: string }[] = [];
    for (const folder of tooling.lintFolders)
        list.push({
            path: `${folder}/`,
            note: 'a folder of lint scripts; check remaining references before deleting it',
        });
    for (const manifest of tooling.lintOnlyManifests)
        list.push({ path: manifest, note: 'a manifest whose dependencies are all tools gspot now pins' });
    const [first] = duplicatePins;
    if (first) {
        const noun = duplicatePins.length === 1 ? 'pin' : 'pins';
        list.push({
            path: first.place,
            note: `${String(duplicatePins.length)} ${noun} gspot also pins (gspot doctor lists them)`,
        });
    }
    return list;
}

/**
 * Owned tools among the ones found, given the selection.
 * @param tooling the configuration files found
 * @param selected the ids of the selected configurations
 * @returns the tool names, sorted
 */
export function ownedTools(tooling: ExistingTooling, selected: Set<string>): string[] {
    return sortedUnique(
        tooling.configs.filter((config) => isOwned(config.tool, selected)).map((config) => config.tool),
    );
}

/**
 * Tools found for which no selected configuration exists.
 * @param tooling the configuration files found
 * @param selected the ids of the selected configurations
 * @returns the tool names, sorted
 */
export function unownedTools(tooling: ExistingTooling, selected: Set<string>): string[] {
    return sortedUnique(
        tooling.configs.filter((config) => !isOwned(config.tool, selected)).map((config) => config.tool),
    );
}
