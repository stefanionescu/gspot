import { stylelintImporter } from '#cli/policy/adoption/stylelint.ts';

import { markdownImporter } from '#cli/policy/adoption/markdownlint.ts';

import { ruffImporter } from '#cli/policy/adoption/ruff.ts';

import { licensesImporter } from '#cli/policy/adoption/licenses.ts';

import { osvImporter } from '#cli/policy/adoption/osv.ts';

import { gitleaksImporter } from '#cli/policy/adoption/gitleaks.ts';

import { typosImporter } from '#cli/policy/adoption/typos.ts';

import { z } from 'zod';

import type { CarrySource } from '#cli/policy/adoption/source.ts';

import { ignoreFileEntries } from '#cli/policy/adoption/ignore-files.ts';

import type { ExistingTool } from '#cli/repository/existing-tooling.ts';

import { appendSetting, type CarriedConfiguration } from '#cli/policy/adoption/results.ts';

import { carryDisabled, carryPyright, valueOfKeyLine } from '#cli/policy/adoption/disabled.ts';

import { dirname } from 'node:path';

import { collectEslint } from '#cli/policy/adoption/eslint.ts';

import { collectFormatting } from '#cli/policy/adoption/formatting.ts';

import type { ExistingTooling } from '#cli/repository/existing-tooling.ts';

import { configurationManifests } from '#cli/configurations/read-manifests.ts';

import { observeConfiguration, parseCarrySource } from '#cli/policy/adoption/source.ts';

const strings = z.array(z.string());

const nativeImporters: Record<
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
 * Reads what one old configuration file holds that gspot keeps: exception lists for the four list tools, disabled rules for the rest.
 * @param source the input already read and parsed
 * @param tool the tool the file configures
 * @param path the file, relative to the root
 * @param lists the lists the entries are added to
 * @param root
 * @param reader
 * @param check
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
        const key = tool === 'sqlfluff' ? 'exclude' : tool === 'semgrep' ? 'ignore' : undefined;
        if (key === undefined) throw new Error(`${path}: no complete ${tool} ignore-path importer is available.`);
        appendSetting(lists, tool, key, ignoreFileEntries(source.text, path));
        return;
    }

    if (tool === 'shellcheck') {
        const unsupported = source.text.split('\n').find((line) => {
            const content = line.trim();
            return content !== '' && !content.startsWith('#') && valueOfKeyLine(line, 'disable') === undefined;
        });
        if (unsupported !== undefined)
            throw new Error(`${path}: unsupported configuration line ${JSON.stringify(unsupported)}.`);
    } else {
        const schema = nativeImporters[tool]?.schema;
        if (schema === undefined) throw new Error(`${path}: no complete ${tool} configuration importer is available.`);
        const parsed = schema.safeParse(source.parsed);
        if (!parsed.success)
            throw new Error(
                `${path}: unsupported settings: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
            );
    }
    const carrier =
        reader === 'words'
            ? typosImporter.carry
            : reader === 'advisories'
              ? osvImporter.carry
              : reader === 'licenses'
                ? licensesImporter.carry
                : nativeImporters[tool]?.carry;
    if (carrier) await carrier(source, path, lists, root, check);
    else carryDisabled(source, tool, path, lists, check);
}

function sortedUnique(items: string[]): string[] {
    return [...new Set(items)].toSorted((a, b) => a.localeCompare(b));
}

/**
 * True when a selected configuration declares adoption for the tool.
 * @param tool the tool a configuration file belongs to
 * @param selected the ids of the selected configurations
 * @returns whether takeover replaces the tool's configuration
 */
export function isOwned(tool: string, selected: Set<string>): boolean {
    const manifests = configurationManifests();
    return [...selected].some((id) =>
        manifests.get(id)?.tools.some((entry) => entry.name === tool && entry.takeover !== undefined),
    );
}

/**
 * Reads carried settings from each declared configuration of the selected tools. Deletes nothing.
 * @param root the repository root
 * @param tooling the configuration files, hooks and lint folders found
 * @param selected the ids of the selected configurations
 * @param paths
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
    const separate = owned.filter(({ tool }) =>
        ['ruff', 'typos', 'stylelint', 'markdownlint-cli2', 'license-checker-rseidelsohn'].includes(tool),
    );
    for (const entry of separate) {
        const base = dirname(entry.path);
        if (
            separate.some(
                (other) =>
                    other.tool === entry.tool &&
                    other !== entry &&
                    (base === '.' || dirname(other.path) === base || dirname(other.path).startsWith(`${base}/`)),
            )
        )
            lists.unread.push({
                path: entry.path,
                note: `Overlapping ${entry.tool} configuration requires explicit conversion before adoption.`,
            });
    }
    // Capture all tools before any executable configuration can change another tool's input.
    for (const path of new Set(owned.map(({ path }) => path))) {
        try {
            lists.observed.set(path, observeConfiguration(root, path).original);
        } catch (error) {
            lists.unread.push({ path, note: `not read and not deleted: ${(error as Error).message}` });
        }
    }
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
    for (const { tool, path, shared, table, key, carries, check } of owned) {
        if (tool === 'prettier' || tool === 'ec' || carries === 'eslint-config') continue;
        try {
            const selector =
                table === undefined && key === undefined
                    ? undefined
                    : { ...(table === undefined ? {} : { table }), ...(key === undefined ? {} : { key }) };
            const source = parseCarrySource(lists.observed.get(path)!, tool, path, selector);
            await carryFrom(source, tool, path, lists, root, carries, check);
        } catch (error) {
            lists.unread.push({ path, note: `not read and not deleted: ${(error as Error).message}` });
            continue;
        }
        if (shared === true)
            lists.retained.push({
                path,
                note: `${table ?? key ?? tool} settings are represented in gspot configuration; remove that section manually`,
            });
        else lists.removed.push({ path, note: `replaced by gspot's ${tool} configuration` });
    }
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
