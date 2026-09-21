import { evaluateConfiguration } from './configuration.ts';
import { eslintResponse } from './eslint-request.ts';
// Observe configuration carryover before retiring supported inputs through the lifecycle owner.
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import type { FileSnapshot, TakeoverRemovalResult } from '#types/lifecycle.ts';
import type { ExistingTooling } from '#types/repository.ts';
import { carryResolvedFormat, carryPrettier } from '#cli/lifecycle/format.ts';
import { carryFrom, observeConfiguration, parseCarrySource } from '#cli/lifecycle/carry.ts';
import type { CarriedLists, TakeoverPlan } from '#types/lifecycle.ts';

const DELETED_ALONGSIDE_OWNER: Record<string, string> = {
    sqlfluffignore: 'sql',
    semgrepignore: 'security',
    bearer: 'security',
    whitelizard: 'javascript',
    qlty: 'structure',
};

const OWNER_PRESET: Record<string, string[]> = {
    eslint: ['typescript', 'javascript'],
    prettier: ['formatting'],
    prettierignore: ['formatting'],
    editorconfig: ['formatting'],
    typos: ['spelling'],
    markdownlint: ['markdown'],
    commitlint: ['commits'],
    shellcheck: ['bash'],
    sqlfluff: ['sql'],
    swiftlint: ['swift'],
    swiftformat: ['swift'],
    periphery: ['swift'],
    gitleaks: ['secrets'],
    osv: ['dependencies'],
    licenses: ['licenses'],
    squawk: ['postgres'],
    hadolint: ['docker'],
    stylelint: ['css'],
    'html-validate': ['html'],
    lychee: ['docs'],
    syncpack: ['dependencies'],
    knip: ['typescript', 'javascript'],
    jscpd: ['duplication'],
    pyright: ['python'],
    ruff: ['python'],
    yamllint: ['config-files'],
    taplo: ['config-files'],
    vale: ['prose'],
    trivy: ['docker'],
    linkinator: ['static-site'],
};

function sortedUnique(items: string[]): string[] {
    return [...new Set(items)].toSorted((a, b) => a.localeCompare(b));
}

/**
 * True when a selected preset owns a tool, or deletes its file along with the owner.
 * @param tool the tool a configuration file belongs to
 * @param selected the ids of the selected presets
 * @returns whether takeover replaces the tool's configuration
 */
export function isOwned(tool: string, selected: Set<string>): boolean {
    const owners = OWNER_PRESET[tool] ?? [];
    if (owners.some((owner) => selected.has(owner))) return true;
    const deleter = DELETED_ALONGSIDE_OWNER[tool];
    return deleter !== undefined && selected.has(deleter);
}

async function collectFormatting(
    root: string,
    configs: ExistingTooling['configs'],
    paths: string[],
    lists: CarriedLists,
): Promise<void> {
    const [first] = configs;
    if (first === undefined) return;
    const staticRoot =
        configs.length === 1 &&
        first.tool === 'prettier' &&
        !first.path.includes('/') &&
        !/\.(?:[cm]?[jt]s|json5)$/u.test(first.path) &&
        !/^package\.(?:json|yaml)$/u.test(first.path);
    try {
        if (staticRoot) {
            const source = parseCarrySource(lists.observed.get(first.path)!, first.tool, first.path);
            lists.formatter = await carryPrettier(root, source, first.path, paths);
            if (source.parsed['overrides'] === undefined) {
                lists.removed.push({ path: first.path, note: "replaced by gspot's prettier configuration" });
                return;
            }
        } else {
            lists.formatter = await carryResolvedFormat(
                root,
                paths,
                first.path,
                configs.find(({ tool, path }) => tool === 'prettierignore' && path === '.prettierignore')?.path,
            );
        }
        if (lists.formatter.ignoredPaths?.length)
            lists.ignores.push({
                check: 'formatting/prettier',
                paths: lists.formatter.ignoredPaths,
                reason: 'carried from .prettierignore at init',
            });
        for (const { tool, path } of configs)
            lists.retained.push({
                path,
                note:
                    tool === 'prettierignore'
                        ? path === '.prettierignore'
                            ? 'original Prettier ignore patterns remain active; captured ignores describe current files only'
                            : 'nested ignore file remains in place; gspot Prettier commands read only the root .prettierignore'
                        : tool === 'editorconfig'
                          ? 'original EditorConfig remains active; captured formatting overrides describe current files only'
                          : 'original Prettier selectors remain active; captured formatting overrides describe current files only',
            });
    } catch (error) {
        lists.unread.push({ path: first.path, note: `not read and not deleted: ${(error as Error).message}` });
    }
}

async function collectEslint(
    root: string,
    configs: ExistingTooling['configs'],
    paths: string[],
    selected: Set<string>,
    lists: CarriedLists,
): Promise<void> {
    const [first] = configs;
    if (first === undefined) return;
    try {
        const carried = eslintResponse.parse(
            await evaluateConfiguration({
                tool: 'eslint',
                operation: 'rules',
                root,
                paths,
                flat: configs.some(({ path }) => /(?:^|\/)eslint\.config\./u.test(path)),
            }),
        );
        if (carried.overrides.length > 0) lists.eslintOverrides = carried.overrides;
        const checks = ['javascript', 'typescript']
            .filter((preset) => selected.has(preset))
            .map((preset) => `${preset}/eslint`);
        for (const check of checks)
            for (const entry of carried.ignores)
                lists.ignores.push({
                    check,
                    paths: entry.paths,
                    ...(entry.rule === undefined ? {} : { rule: entry.rule }),
                    reason: `carried from ${first.path} at init`,
                });
        for (const { path } of configs) lists.retained.push({ path, note: carried.notes.join('; ') });
    } catch (error) {
        lists.unread.push({ path: first.path, note: `not read and not deleted: ${(error as Error).message}` });
    }
}

/**
 * Reads the carry lists from every conventional configuration file an owned tool has. Deletes nothing.
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
): Promise<CarriedLists> {
    const lists: CarriedLists = {
        observed: new Map(),
        typosWords: [],
        typosExcludes: [],
        pyrightExcludes: [],
        sqlfluffExcludes: [],
        semgrepIgnores: [],
        gitleaksAllow: [],
        osvIgnores: [],
        licenseExceptions: [],
        licenseAllow: [],
        ignores: [],
        removed: [],
        unread: [],
        retained: [],
    };
    const owned = tooling.configs.filter(({ tool }) => isOwned(tool, selected));
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
        owned.filter(({ tool }) => tool === 'prettier' || tool === 'prettierignore' || tool === 'editorconfig'),
        paths,
        lists,
    );
    await collectEslint(
        root,
        owned.filter(({ tool }) => tool === 'eslint'),
        paths,
        selected,
        lists,
    );
    for (const { tool, path } of owned) {
        if (tool === 'prettier' || tool === 'prettierignore' || tool === 'editorconfig' || tool === 'eslint') continue;
        try {
            const source = parseCarrySource(lists.observed.get(path)!, tool, path);
            carryFrom(source, tool, path, lists);
        } catch (error) {
            lists.unread.push({ path, note: `not read and not deleted: ${(error as Error).message}` });
            continue;
        }
        lists.removed.push({ path, note: `replaced by gspot's ${tool} configuration` });
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
        list.push({ path: `${folder}/`, note: 'a folder of lint scripts; nothing in the gate calls it' });
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
