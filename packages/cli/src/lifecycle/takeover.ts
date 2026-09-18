// Takeover at init: delete the old configuration of every owned tool, carry the exception lists, list what stops running.
import { join } from 'node:path';
import { carryFrom } from '#cli/lifecycle/carry.ts';
import { existsSync, rmSync, statSync } from 'node:fs';
import type { ExistingTooling } from '#types/repository.ts';
import { unreadableReason } from '#cli/lifecycle/unreadable.ts';
import type { CarriedLists, TakeoverPlan } from '#types/lifecycle.ts';

const DELETED_ALONGSIDE_OWNER: Record<string, string> = {
    prettierignore: 'formatting',
    sqlfluffignore: 'sql',
    semgrepignore: 'vulnerabilities',
    bearer: 'vulnerabilities',
    whitelizard: 'javascript',
    qlty: 'structure',
};

const OWNER_PRESET: Record<string, string[]> = {
    eslint: ['typescript', 'javascript'],
    prettier: ['formatting'],
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

/**
 * Reads the carry lists from every conventional configuration file an owned tool has. Deletes nothing.
 * @param root the repository root
 * @param tooling the configuration files, hooks and lint folders found
 * @param selected the ids of the selected presets
 * @returns the lists to write into gspot.toml and the files takeover replaces
 */
export function collectCarried(root: string, tooling: ExistingTooling, selected: Set<string>): CarriedLists {
    const lists: CarriedLists = {
        typosWords: [],
        typosExcludes: [],
        gitleaksAllow: [],
        osvIgnores: [],
        licenseExceptions: [],
        licenseAllow: [],
        ignores: [],
        removed: [],
        unread: [],
    };
    for (const { tool, path } of tooling.configs) {
        if (!isOwned(tool, selected)) continue;
        const problem = unreadableReason(root, path);
        if (problem !== undefined) {
            lists.unread.push({ path, note: `not read and not deleted: ${problem}` });
            continue;
        }
        carryFrom(root, tool, path, lists);
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
    for (const hook of tooling.hooks)
        if (hook.kind === 'githooks' || hook.kind === 'hooksPath')
            list.push({ path: `${hook.path}/`, note: 'core.hooksPath now points at .gspot/hooks' });
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

/**
 * Deletes the files takeover replaces. Git keeps them.
 * @param root the repository root
 * @param removed the paths to delete, relative to the root
 * @returns the paths that were there and are now gone
 */
export function deleteReplaced(root: string, removed: { path: string }[]): string[] {
    const deleted: string[] = [];
    for (const entry of removed) {
        const full = join(root, entry.path);
        if (!existsSync(full)) continue;
        rmSync(full, { recursive: statSync(full).isDirectory(), force: true });
        deleted.push(entry.path);
    }
    return deleted;
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
