// Build each distinct tool file text once, and give its path to every scope that uses it.
import { join } from 'node:path/posix';
import type { Session } from '#cli/types/planning.ts';
import { buildToolFile } from '#cli/generation/tool-files/build.ts';
import { TOOL_FILE_SCOPES_FOLDER } from '#cli/config/generation/files.ts';
import { listPointerPaths, buildPointerFiles } from '#cli/generation/pointers.ts';
import { listToolFileDeclarations } from '#cli/generation/tool-files/declarations.ts';

import type {
    WholeToolFile,
    ToolFileContent,
    ToolFileSelection,
    ToolFileGeneration,
    ToolFileGenerationState,
} from '#cli/types/generation/files.ts';

// Root outputs win the shared path; other equal-content groups prefer the most scopes.
function groupToolOutputs(
    session: Session,
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
                level: session.settingsFile.settings.level,
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

// The first text keeps the declared path. A root file with other text goes to its scope, and any other tool file to
// scopes/<scope>/ in the folder of its configuration.
function chooseTarget(declared: string, index: number, first: ToolFileContent): string {
    if (index === 0) return declared;
    const { file, root } = first.toolFile;
    const scope = first.owner.selection.scope.path;
    if (root) return join(scope, declared);
    return join(declared.slice(0, declared.length - file.length), TOOL_FILE_SCOPES_FOLDER, scope, file);
}

// Record one text group at its chosen path and map every participating scope to it.
function recordToolOutput(
    session: Session,
    declared: string,
    group: ToolFileContent[],
    index: number,
    state: ToolFileGenerationState,
): void {
    const [first] = group as [ToolFileContent, ...ToolFileContent[]];
    const chosen = chooseTarget(declared, index, first);
    const file =
        chosen === declared
            ? first.file
            : buildToolFile(
                  {
                      ...first.owner,
                      toolFile: first.toolFile,
                      targetPath: chosen,
                      level: session.settingsFile.settings.level,
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
function buildWholeFiles(session: Session, declarations: ToolFileSelection[], state: ToolFileGenerationState): void {
    const whole = declarations.filter(
        (entry): entry is ToolFileSelection & { toolFile: WholeToolFile } => entry.toolFile.source !== undefined,
    );
    for (const [declared, entries] of Map.groupBy(whole, ({ toolFile }) => toolFile.target)) {
        const groups = groupToolOutputs(session, entries, state);
        for (const [index, group] of groups.entries()) recordToolOutput(session, declared, group, index, state);
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

function writePointers(
    selected: ToolFileSelection,
    declarations: ToolFileSelection[],
    state: ToolFileGenerationState,
): void {
    const { toolFile, owner } = selected;
    const target = getSelectedTarget(selected, state) ?? toolFile.target;
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

/**
 * Build the tool files. Scopes with the same text share one file, and every pointer resolves to its path.
 * @param session the repository to build for.
 * @returns the tool files, and the path that each scope uses.
 */
function buildToolFiles(session: Session): ToolFileGeneration {
    const declarations = listToolFileDeclarations(session);
    const state: ToolFileGenerationState = { targets: new Map(), files: new Map() };
    buildWholeFiles(session, declarations, state);
    for (const entry of declarations) writePointers(entry, declarations, state);
    return { files: [...state.files.values()], targets: state.targets };
}

export { buildToolFiles };
