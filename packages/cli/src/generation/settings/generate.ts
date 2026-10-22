// Build each distinct tool file text once, and give its path to every scope that uses it.
import { join } from 'node:path/posix';
import type { Session } from '#cli/types/session.ts';
import { type CacheKey } from '#cli/types/system/files.ts';
import type { ToolFile } from '#cli/types/configurations.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { buildToolFile } from '#cli/generation/settings/build.ts';
import { TOOL_FILE_SCOPES_FOLDER } from '#cli/config/generation/settings/generate.ts';
import { getToolFileTarget, listOwnedToolFiles } from '#cli/generation/settings/needed.ts';
import { listPointerPaths, buildPointerFiles } from '#cli/generation/settings/pointers.ts';

import type {
    WholeToolFile,
    BuiltToolFile,
    OwnedToolFile,
    ToolFileGeneration,
    GeneratedToolFiles,
} from '#cli/types/generation/files.ts';

const toolFilesKey: CacheKey<Map<Session, ToolFileGeneration>> = { create: () => new Map() };

/**
 * Reuse generated settings only while the session keeps the same repository read cache.
 *
 * @param session the current settings, scopes, and repository files.
 * @returns the generated settings and scope destinations.
 */
export function getToolFiles(session: Session): ToolFileGeneration {
    return getCachedMapValue(session.reads, toolFilesKey, session, () => buildToolFiles(session));
}

// Root outputs win the shared path; other equal-content groups prefer the most scopes.
function groupToolOutputs(
    entries: (OwnedToolFile & { toolFile: WholeToolFile })[],
    generated: GeneratedToolFiles,
): BuiltToolFile[][] {
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
            generated.targets,
        ),
    }));
    return [...Map.groupBy(outputs, ({ file }) => file.content).values()].toSorted(
        (left, right) =>
            Number(right.some(({ owner }) => owner.scope.folder.path === '')) -
                Number(left.some(({ owner }) => owner.scope.folder.path === '')) || right.length - left.length,
    );
}

// Record one text group at its chosen path and map every participating scope to it.
function addToolOutput(declared: string, group: BuiltToolFile[], index: number, generated: GeneratedToolFiles): void {
    const [first] = group as [BuiltToolFile, ...BuiltToolFile[]];
    const chosen = index === 0 ? declared : buildPerScopeTarget(first.toolFile, first.owner.scope.folder.path);
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
                  generated.targets,
              );
    generated.files.set(chosen, file);
    for (const { owner } of group) {
        const scope = owner.scope.folder.path;
        const paths = generated.targets.get(scope) ?? new Map<string, string>();
        paths.set(declared, chosen);
        generated.targets.set(scope, paths);
    }
}

// Build the tool files that have their own text first, so that the pointers can name their paths.
function buildWholeFiles(toolFiles: OwnedToolFile[], generated: GeneratedToolFiles): void {
    const whole = toolFiles.filter(
        (entry): entry is OwnedToolFile & { toolFile: WholeToolFile } => entry.toolFile.source !== undefined,
    );
    for (const [declared, entries] of Map.groupBy(whole, ({ toolFile }) => toolFile.target)) {
        const groups = groupToolOutputs(entries, generated);
        for (const [index, group] of groups.entries()) addToolOutput(declared, group, index, generated);
    }
}

// A pointer-only tool file replaces the generic one for the same scope and target.
function listPointerOnlyPaths(toolFiles: OwnedToolFile[], selected: OwnedToolFile): Set<string> {
    return new Set(
        toolFiles
            .filter(
                (entry) =>
                    entry.owner.scope.folder.path === selected.owner.scope.folder.path &&
                    entry.toolFile.source === undefined &&
                    entry.toolFile.target === selected.toolFile.target,
            )
            .flatMap((entry) => listPointerPaths(entry.owner, entry.toolFile)),
    );
}

function addPointerFiles(selected: OwnedToolFile, toolFiles: OwnedToolFile[], generated: GeneratedToolFiles): void {
    const { toolFile, owner } = selected;
    const target = getToolFileTarget(owner.scope.folder.path, toolFile, generated.targets);
    if (isRootPointerShared(selected, toolFiles, target)) return;
    const pointerOnlyPaths = listPointerOnlyPaths(toolFiles, selected);
    for (const pointer of buildPointerFiles(owner, toolFile, target)) {
        if (
            toolFile.source === undefined ||
            toolFile.pointer?.folders !== undefined ||
            !pointerOnlyPaths.has(pointer.path)
        )
            generated.files.set(pointer.path, pointer);
    }
}

// A scope that uses the same tool file as the root needs no pointer of its own when the pointer inherits.
function isRootPointerShared(selected: OwnedToolFile, toolFiles: OwnedToolFile[], target: string): boolean {
    const { toolFile, owner } = selected;
    if (toolFile.pointer?.inherit !== true || owner.scope.folder.path === '' || target !== toolFile.target)
        return false;
    return toolFiles.some((entry) => entry.toolFile.target === toolFile.target && entry.owner.scope.folder.path === '');
}

/**
 * Build the tool files. Scopes with the same text share one file, and every pointer resolves to its path.
 *
 * @param session the repository to build for.
 * @returns the tool files, and the path that each scope uses.
 */
function buildToolFiles(session: Session): ToolFileGeneration {
    const toolFiles = listOwnedToolFiles(session);
    const state: GeneratedToolFiles = { targets: new Map(), files: new Map() };
    buildWholeFiles(toolFiles, state);
    for (const entry of toolFiles) addPointerFiles(entry, toolFiles, state);
    return { files: [...state.files.values()], targets: state.targets };
}

/**
 * Name the path of a tool file that a scope writes with its own text: a root file in the scope folder, and any other
 * tool file in scopes/<scope>/ of the folder of its configuration.
 *
 * @param toolFile the tool file to place.
 * @param scope the folder of the scope.
 * @returns the repository-relative path.
 */
export function buildPerScopeTarget(toolFile: Pick<ToolFile, 'target' | 'file' | 'root'>, scope: string): string {
    if (toolFile.root) return join(scope, toolFile.target);
    const folder = toolFile.target.slice(0, toolFile.target.length - toolFile.file.length);
    return join(folder, TOOL_FILE_SCOPES_FOLDER, scope, toolFile.file);
}
