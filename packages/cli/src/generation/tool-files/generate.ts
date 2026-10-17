// Build each distinct tool file text once, and give its path to every scope that uses it.
import type { Session } from '#cli/types/planning.ts';
import { join, extname, basename } from 'node:path/posix';
import { listRequiredTools } from '#cli/planning/needed-tools.ts';
import { TOOL_FILE_PREFIX } from '#cli/config/system/locations.ts';
import { buildToolFile } from '#cli/generation/tool-files/build.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { isConfigurationSelected } from '#cli/configurations/select.ts';
import type { ToolFileDeclaration } from '#cli/types/configurations.ts';
import { listPointerPaths, buildPointerFiles } from '#cli/generation/pointers.ts';

import type {
    WholeToolFile,
    ToolFileContent,
    NeededToolFiles,
    ToolFileSelection,
    ToolFileGeneration,
    ToolFileGenerationState,
} from '#cli/types/generation/files.ts';

// Constraints select declarations without treating an empty constraint as a requirement.
function isToolFileNeeded(
    session: Session,
    selection: ScopeSelection,
    file: ToolFileDeclaration,
    needed: NeededToolFiles,
): boolean {
    if (file.level === 'all' && session.settingsFile.settings.level !== 'all') return false;
    const constraints = [
        [file.tool, needed.tools],
        [file.check, needed.checks],
    ] as const;
    if (constraints.some(([names, available]) => names.length > 0 && !names.some((name) => available.has(name))))
        return false;
    return (
        file.when === undefined ||
        isConfigurationSelected(file.per_scope ? [selection] : session.scopes, file.when.configuration)
    );
}

// Each scope uses its own checks for scoped declarations and the repository programs for shared declarations.
function listScopeDeclarations(
    session: Session,
    selection: ScopeSelection,
    repository: NeededToolFiles,
): ToolFileSelection[] {
    const checks = session.configuredChecks.filter(
        (planned) => planned.selection.scope.path === selection.scope.path || planned.check.runs === 'once',
    );
    const needed = {
        tools: new Set(checks.flatMap((planned) => listRequiredTools(planned))),
        checks: new Set(checks.map((planned) => planned.check.name)),
    };
    return selection.selected.flatMap((manifest) =>
        manifest.toolFiles
            .filter((file) => isToolFileNeeded(session, selection, file, file.per_scope ? needed : repository))
            .map((toolFile) => ({
                toolFile,
                owner: {
                    session,
                    selection,
                    manifest,
                    scopes: session.scopes,
                    files: session.repository.files,
                    manifests: session.neededToolManifests,
                },
            })),
    );
}

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

// Distinct scope settings share a tool folder while preserving the declared root destination.
function chooseTarget(declared: string, index: number, first: ToolFileContent): string {
    if (index === 0) return declared;
    if (!declared.startsWith(TOOL_FILE_PREFIX)) return join(first.owner.selection.scope.path, declared);
    const relative = declared.slice(TOOL_FILE_PREFIX.length);
    const tool = relative.includes('/')
        ? relative.slice(0, relative.indexOf('/'))
        : basename(relative, extname(relative));
    return join(TOOL_FILE_PREFIX, tool, first.owner.selection.scope.path, basename(declared));
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
        (entry): entry is ToolFileSelection & { toolFile: WholeToolFile } =>
            !entry.toolFile.fragment && entry.toolFile.source !== undefined,
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
    if (toolFile.fragment) return;
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
    const repository = {
        tools: new Set(session.neededToolManifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name))),
        checks: new Set(session.configuredChecks.map((planned) => planned.check.name)),
    };
    const declarations = session.scopes.flatMap((selection) => listScopeDeclarations(session, selection, repository));
    const state: ToolFileGenerationState = { targets: new Map(), files: new Map() };
    buildWholeFiles(session, declarations, state);
    for (const entry of declarations) writePointers(entry, declarations, state);
    return { files: [...state.files.values()], targets: state.targets };
}

export { buildToolFiles };
