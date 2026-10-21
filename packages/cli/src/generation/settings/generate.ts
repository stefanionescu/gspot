// Build each distinct tool file text once, and give its path to every scope that uses it.
import { join } from 'node:path/posix';
import type { Session } from '#cli/types/planning.ts';
import { type MemoKey } from '#cli/types/system/files.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { buildToolFile } from '#cli/generation/settings/build.ts';
import type { ToolFileDeclaration } from '#cli/types/configurations.ts';
import { TOOL_FILE_SCOPES_FOLDER } from '#cli/config/generation/files.ts';
import { listPointerPaths, buildPointerFiles } from '#cli/generation/pointers.ts';
import { listToolFileDeclarations } from '#cli/generation/settings/declarations.ts';

import type {
    WholeToolFile,
    ToolFileContent,
    ToolFileSelection,
    ToolFileGeneration,
    ToolFileGenerationState,
} from '#cli/types/generation/files.ts';

const toolFiles: MemoKey<Map<Session, ToolFileGeneration>> = { create: () => new Map() };

/**
 * Reuse generated settings only while the session keeps the same repository read cache.
 *
 * @param session the current settings, scopes, and repository files.
 * @returns the generated settings and scope destinations.
 */
function getToolFiles(session: Session): ToolFileGeneration {
    return getCachedMapValue(session.reads, toolFiles, session, () => buildToolFiles(session));
}

// Root outputs win the shared path; other equal-content groups prefer the most scopes.
function groupToolOutputs(
    entries: (ToolFileSelection & { toolFile: WholeToolFile })[],
    state: ToolFileGenerationState,
): ToolFileContent[][] {
    const owners = entries[0]?.toolFile.per_scope === true ? entries : entries.slice(0, 1);
    const outputs = owners.map((entry) => ({
        ...entry,
        file: buildToolFile(
            {
                ...entry.owner,
                toolFile: entry.toolFile,
                targetPath: entry.toolFile.target,
                level: entry.owner.session.settingsFile.settings.level,
            },
            state.targets,
        ),
    }));
    return [...Map.groupBy(outputs, ({ file }) => file.content).values()].toSorted(
        (left, right) =>
            Number(right.some(({ owner }) => owner.selection.scope.path === '')) -
                Number(left.some(({ owner }) => owner.selection.scope.path === '')) || right.length - left.length,
    );
}

// Record one text group at its chosen path and map every participating scope to it.
function recordToolOutput(
    declared: string,
    group: ToolFileContent[],
    index: number,
    state: ToolFileGenerationState,
): void {
    const [first] = group as [ToolFileContent, ...ToolFileContent[]];
    const chosen = index === 0 ? declared : formatScopeTarget(first.toolFile, first.owner.selection.scope.path);
    const file =
        chosen === declared
            ? first.file
            : buildToolFile(
                  {
                      ...first.owner,
                      toolFile: first.toolFile,
                      targetPath: chosen,
                      level: first.owner.session.settingsFile.settings.level,
                  },
                  state.targets,
              );
    state.files.set(chosen, file);
    for (const { owner } of group) {
        const scope = owner.selection.scope.path;
        const paths = state.targets.get(scope) ?? new Map<string, string>();
        paths.set(declared, chosen);
        state.targets.set(scope, paths);
    }
}

// Whole-file outputs establish destinations before pointer fragments resolve against them.
function buildWholeFiles(declarations: ToolFileSelection[], state: ToolFileGenerationState): void {
    const whole = declarations.filter(
        (entry): entry is ToolFileSelection & { toolFile: WholeToolFile } => entry.toolFile.source !== undefined,
    );
    for (const [declared, entries] of Map.groupBy(whole, ({ toolFile }) => toolFile.target)) {
        const groups = groupToolOutputs(entries, state);
        for (const [index, group] of groups.entries()) recordToolOutput(declared, group, index, state);
    }
}

// A pointer-only declaration replaces the generic one for the same scope and declared target.
function collectPointerOnlyPaths(declarations: ToolFileSelection[], selected: ToolFileSelection): Set<string> {
    return new Set(
        declarations
            .filter(
                (entry) =>
                    entry.owner.selection.scope.path === selected.owner.selection.scope.path &&
                    entry.toolFile.source === undefined &&
                    entry.toolFile.target === selected.toolFile.target,
            )
            .flatMap((entry) => listPointerPaths(entry.owner, entry.toolFile)),
    );
}

// Both pointer phases resolve the same scope and declaration pair in the output map.
function getSelectedTarget(selected: ToolFileSelection, state: ToolFileGenerationState): string | undefined {
    return state.targets.get(selected.owner.selection.scope.path)?.get(selected.toolFile.target);
}

function addPointerFiles(
    selected: ToolFileSelection,
    declarations: ToolFileSelection[],
    state: ToolFileGenerationState,
): void {
    const { toolFile, owner } = selected;
    const target = getSelectedTarget(selected, state) ?? toolFile.target;
    if (isRootPointerShared(selected, declarations, target)) return;
    const pointerOnlyPaths = collectPointerOnlyPaths(declarations, selected);
    for (const pointer of buildPointerFiles(owner, toolFile, target)) {
        if (
            toolFile.source === undefined ||
            toolFile.pointer?.folders !== undefined ||
            !pointerOnlyPaths.has(pointer.path)
        )
            state.files.set(pointer.path, pointer);
    }
}

// A scope that uses the same tool file as the root needs no pointer of its own when the pointer inherits.
function isRootPointerShared(selected: ToolFileSelection, declarations: ToolFileSelection[], target: string): boolean {
    const { toolFile, owner } = selected;
    if (toolFile.pointer?.inherit !== true || owner.selection.scope.path === '' || target !== toolFile.target)
        return false;
    return declarations.some(
        (entry) => entry.toolFile.target === toolFile.target && entry.owner.selection.scope.path === '',
    );
}

/**
 * Build the tool files. Scopes with the same text share one file, and every pointer resolves to its path.
 *
 * @param session the repository to build for.
 * @returns the tool files, and the path that each scope uses.
 */
function buildToolFiles(session: Session): ToolFileGeneration {
    const declarations = listToolFileDeclarations(session);
    const state: ToolFileGenerationState = { targets: new Map(), files: new Map() };
    buildWholeFiles(declarations, state);
    for (const entry of declarations) addPointerFiles(entry, declarations, state);
    return { files: [...state.files.values()], targets: state.targets };
}

/**
 * Name the path of a tool file that a scope writes with its own text: a root file in the scope folder, and any other
 * tool file in scopes/<scope>/ of the folder of its configuration.
 *
 * @param toolFile the declaration.
 * @param scope the folder of the scope.
 * @returns the repository-relative path.
 */
function formatScopeTarget(toolFile: Pick<ToolFileDeclaration, 'target' | 'file' | 'root'>, scope: string): string {
    if (toolFile.root) return join(scope, toolFile.target);
    const folder = toolFile.target.slice(0, toolFile.target.length - toolFile.file.length);
    return join(folder, TOOL_FILE_SCOPES_FOLDER, scope, toolFile.file);
}

export { getToolFiles, formatScopeTarget };
