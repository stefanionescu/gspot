import { evaluateConfiguration } from './configuration.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import { basename, dirname } from 'node:path';
import { parseBuffer } from 'editorconfig';
import { policySchema } from '#cli/policy/schema.ts';
import { eslintResponse } from './eslint-evaluation.ts';
// Observe configuration carryover before retiring supported inputs through the lifecycle owner.
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import type { FileSnapshot, TakeoverRemovalResult } from '#cli/lifecycle/types.ts';
import type { ExistingTooling } from '#cli/repository/types.ts';
import { carryFormat } from '#cli/lifecycle/format-evaluation.ts';
import { carriedTool, carryFrom, observeConfiguration, parseCarrySource } from '#cli/lifecycle/carry.ts';
import type { CarriedConfiguration, TakeoverPlan } from '#cli/lifecycle/types.ts';

function sortedUnique(items: string[]): string[] {
    return [...new Set(items)].toSorted((a, b) => a.localeCompare(b));
}

/**
 * True when a selected preset declares adoption for the tool.
 * @param tool the tool a configuration file belongs to
 * @param selected the ids of the selected presets
 * @returns whether takeover replaces the tool's configuration
 */
export function isOwned(tool: string, selected: Set<string>): boolean {
    const manifests = presetManifests();
    return [...selected].some((id) =>
        manifests.get(id)?.tools.some((entry) => entry.name === tool && entry.takeover !== undefined),
    );
}

async function collectFormatting(
    root: string,
    configs: ExistingTooling['configs'],
    lists: CarriedConfiguration,
): Promise<void> {
    const [first] = configs;
    if (first === undefined) return;
    try {
        const unsupported = configs.find(({ carries, path }) => carries === 'ignore-paths' && path.includes('/'));
        if (unsupported !== undefined)
            throw new Error(
                `Formatting conversion does not support ${unsupported.path}. Its configuration remains intact.`,
            );
        const format = configs.filter(({ tool, carries }) => tool === 'prettier' && carries !== 'ignore-paths');
        const editorconfigs = configs.filter(({ tool }) => tool === 'ec');
        const editorconfig = editorconfigs.find(({ path }) => !path.includes('/'));
        const document = (path: string) => {
            const sections = parseBuffer(lists.observed.get(path)!.bytes);
            return {
                preamble: sections.find(([glob]) => glob === null)?.[1] ?? {},
                sections: sections
                    .filter(([glob]) => glob !== null)
                    .map(([glob, properties]) => ({ glob, properties })),
            };
        };
        const adopted =
            editorconfigs.length === 0
                ? undefined
                : policySchema.shape.tools
                      .unwrap()
                      .shape.editorconfig.unwrap()
                      .shape.adopted.unwrap()
                      .parse({
                          ...(editorconfig === undefined
                              ? { preamble: {}, sections: [] }
                              : document(editorconfig.path)),
                          directories: editorconfigs
                              .filter(({ path }) => path.includes('/'))
                              .map(({ path }) => ({
                                  basePath: dirname(path).replaceAll('\\', '/'),
                                  ...document(path),
                              })),
                      });
        const folders = new Set(format.map(({ path }) => dirname(path)));
        if (folders.size !== format.length)
            throw new Error('Multiple Prettier configurations in one directory require explicit conversion.');
        const sources = format.map((input) => ({
            from: input.path,
            ...(/\.[cm]?[jt]s$/u.test(input.path) || /^package\./u.test(basename(input.path))
                ? {}
                : { source: parseCarrySource(lists.observed.get(input.path)!, input.tool, input.path) }),
        }));
        lists.formatter = await carryFormat(
            root,
            sources,
            configs.find(({ carries }) => carries === 'ignore-paths')?.path,
            adopted !== undefined,
        );
        if (adopted !== undefined) {
            lists.formatter.nativeDefaults = true;
            lists.formatter.editorconfig = adopted;
        }
        for (const { path } of configs) {
            if (/^package\./u.test(basename(path)))
                lists.retained.push({
                    path,
                    note: 'Package metadata retained; formatter options and selectors are represented in gspot configuration',
                });
            else
                lists.removed.push({
                    path,
                    note: 'Formatting options and ordered selectors are represented in gspot configuration',
                });
        }
    } catch (error) {
        lists.unread.push({ path: first.path, note: `not read and not deleted: ${(error as Error).message}` });
    }
}

async function collectEslint(
    root: string,
    configs: ExistingTooling['configs'],
    paths: string[],
    lists: CarriedConfiguration,
): Promise<void> {
    const [first] = configs;
    if (first === undefined) return;
    try {
        if (configs.every(({ path }) => basename(path) === '.eslintignore'))
            throw new Error('ESLint ignore adoption requires the configuration that uses it.');
        const nestedIgnore = configs.find(({ path }) => basename(path) === '.eslintignore' && path.includes('/'));
        if (nestedIgnore !== undefined)
            throw new Error(
                `ESLint does not load ${nestedIgnore.path} from the repository root. Convert it before adoption.`,
            );
        const flat = configs.some(({ path }) => /(?:^|\/)eslint\.config\./u.test(path));
        if (flat && (configs.length !== 1 || first.path.includes('/')))
            throw new Error(
                `ESLint conversion requires one root configuration. Convert ${configs.map(({ path }) => path).join(', ')} before adoption.`,
            );
        const carried = eslintResponse.parse(
            await evaluateConfiguration({
                tool: 'eslint',
                operation: 'rules',
                root,
                paths,
                from: first.path,
                flat,
                configs: configs.map(({ path }) => path),
            }),
        );
        carriedTool(lists, 'eslint').settings['adopted'] = carried.adopted;
        for (const { path } of configs) {
            if (basename(path) === 'package.json')
                lists.retained.push({
                    path,
                    note: 'Package metadata retained; ESLint configuration is represented in gspot configuration',
                });
            else
                lists.removed.push({
                    path,
                    note: 'ESLint selectors, options, and module registrations are represented in gspot configuration',
                });
        }
    } catch (error) {
        lists.unread.push({ path: first.path, note: `not read and not deleted: ${(error as Error).message}` });
    }
}

/**
 * Reads carried settings from each declared configuration of the selected tools. Deletes nothing.
 * @param root the repository root
 * @param tooling the configuration files, hooks and lint folders found
 * @param selected the ids of the selected presets
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
): TakeoverPlan['noLongerRuns'] {
    const list: TakeoverPlan['noLongerRuns'] = [];
    for (const folder of tooling.lintFolders)
        list.push({ path: `${folder}/`, note: 'a folder of lint scripts; check remaining references before deleting it' });
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

/** Retire explicitly replaced files after saving recoverable originals; retain directories. */
export function retireReplaced(
    root: string,
    removed: { path: string }[],
    observed: ReadonlyMap<string, FileSnapshot>,
): TakeoverRemovalResult {
    return withLifecycleOwner(root, (owner) => {
        const result: TakeoverRemovalResult = { removed: [], preserved: [] };
        const proposals = [];
        for (const entry of removed) {
            if (entry.path.endsWith('/')) {
                result.preserved.push(entry.path);
                continue;
            }
            const expected = observed.get(entry.path);
            if (expected === undefined) throw new Error(`No takeover observation exists for ${entry.path}.`);
            const proposal = owner.proposeRetirement(entry.path, expected);
            proposals.push(proposal);
            const status = proposal.status;
            if (status === 'changed') result.removed.push(entry.path);
            else if (status === 'preserved') result.preserved.push(entry.path);
        }
        owner.applyProposals(proposals.filter((proposal) => proposal.status !== 'preserved'));
        return result;
    });
}

/**
 * Owned tools among the ones found, given the selection.
 * @param tooling the configuration files found
 * @param selected the ids of the selected presets
 * @returns the tool names, sorted
 */
export function ownedTools(tooling: ExistingTooling, selected: Set<string>): string[] {
    return sortedUnique(
        tooling.configs.filter((config) => isOwned(config.tool, selected)).map((config) => config.tool),
    );
}

/**
 * Tools found for which no selected preset exists.
 * @param tooling the configuration files found
 * @param selected the ids of the selected presets
 * @returns the tool names, sorted
 */
export function unownedTools(tooling: ExistingTooling, selected: Set<string>): string[] {
    return sortedUnique(
        tooling.configs.filter((config) => !isOwned(config.tool, selected)).map((config) => config.tool),
    );
}
