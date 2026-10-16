import { join, dirname } from 'node:path/posix';
import type { Session } from '#cli/types/planning.ts';
import { buildScopeTarget } from '#cli/repository/scopes.ts';
import { buildPointerFiles } from '#cli/generation/pointers.ts';
import { TOOL_FILE_PREFIX } from '#cli/config/system/locations.ts';
import { buildToolFile } from '#cli/generation/tool-files/build.ts';
import { TOOL_FILE_REFERENCE } from '#cli/config/generation/files.ts';
import { isConfigurationSelected } from '#cli/configurations/select.ts';
import type { ToolFileDeclaration } from '#cli/types/configurations.ts';

import type {
    GeneratedFile,
    ToolFileTarget,
    GenerationInputs,
    GenerationConsumers,
} from '#cli/types/generation/files.ts';

// Scoped targets require their dependency in the same scope; repository-wide targets use the full selection.
function isTargetEnabled(
    toolFile: ToolFileDeclaration,
    context: GenerationInputs,
    consumers: GenerationConsumers,
): boolean {
    if (toolFile.level === 'all' && context.session.settingsFile.settings.level !== 'all') return false;
    const needed = toolFile.per_scope ? consumers.scope : consumers.repository;
    const constraints = [
        [toolFile.tool, needed.tools],
        [toolFile.check, needed.checks],
    ] as const;
    if (constraints.some(([names, available]) => names.length > 0 && !names.some((name) => available.has(name))))
        return false;
    return (
        toolFile.when === undefined ||
        isConfigurationSelected(toolFile.per_scope ? [context.selection] : context.scopes, toolFile.when.configuration)
    );
}
// Tool files that refer to each other must share the same root or scope placement.
function groupRelatedTargets(scopeTargets: ToolFileTarget[], files: Map<string, GeneratedFile>): ToolFileTarget[][] {
    const references = new Map(
        scopeTargets.map(({ target }) => [
            target,
            new Set(
                [...(files.get(target) as GeneratedFile).content.matchAll(TOOL_FILE_REFERENCE)].map((match) =>
                    join(dirname(target), (match.groups as Record<string, string>)['path'] as string),
                ),
            ),
        ]),
    );
    const groups: ToolFileTarget[][] = [];
    const seen = new Set<string>();
    for (const target of scopeTargets) {
        if (seen.has(target.target)) continue;
        const group: ToolFileTarget[] = [];
        const pending = [target];
        while (pending.length > 0) {
            const current = pending.pop() as ToolFileTarget;
            if (seen.has(current.target)) continue;
            seen.add(current.target);
            group.push(current);
            pending.push(
                ...scopeTargets.filter(
                    (peer) =>
                        !seen.has(peer.target) &&
                        ((references.get(current.target) as Set<string>).has(peer.target) ||
                            (references.get(peer.target) as Set<string>).has(current.target)),
                ),
            );
        }
        groups.push(group);
    }
    return groups;
}
/**
 * Remove scope copies equal to their root files and point their consumers at the retained files.
 * @param session the selected repository scopes and tool manifests.
 * @param generated the generated files before scope deduplication.
 * @returns the retained files with their updated pointers.
 */
function removeDuplicateToolFiles(session: Session, generated: GeneratedFile[]): GeneratedFile[] {
    // Earlier scopes own repeated destinations; the root scope comes first.
    const files = new Map(generated.toReversed().map((file) => [file.path, file]));
    const targets = session.scopes.flatMap((selection) =>
        listToolFileTargets({
            session,
            selection,
            scopes: session.scopes,
            manifests: session.neededToolManifests,
            files: session.repository.files,
        }),
    );
    const groups = session.scopes
        .filter(({ scope }) => scope.path !== '')
        .flatMap(({ scope }) =>
            groupRelatedTargets(
                targets.filter(
                    (target) =>
                        target.owner.selection.scope.path === scope.path &&
                        target.toolFile.per_scope &&
                        !target.toolFile.fragment &&
                        files.has(target.target),
                ),
                files,
            ),
        );
    const fragmentPaths = new Set(targets.flatMap(({ pointers }) => pointers.map(({ path }) => path)));
    const skipped = new Set(
        groups
            .filter((group) =>
                group.every(
                    ({ toolFile, target }) =>
                        files.get(toolFile.target)?.content === (files.get(target) as GeneratedFile).content,
                ),
            )
            .flatMap((group) =>
                group.flatMap(({ toolFile, target, owner }) => [
                    target,
                    ...buildPointerFiles(owner, toolFile, target)
                        .map(({ path }) => path)
                        .filter(
                            (path) =>
                                !fragmentPaths.has(path) &&
                                toolFile.pointer !== undefined &&
                                files.has(toolFile.pointer.path),
                        ),
                ]),
            ),
    );
    const remaining = new Map([...files].filter(([path]) => !skipped.has(path)));
    const available = new Set(remaining.keys());
    for (const { toolFile, owner } of targets.filter(({ toolFile }) => toolFile.per_scope)) {
        for (const pointer of buildPointerFiles(
            owner,
            toolFile,
            buildScopeTarget(owner.selection.scope.path, toolFile, available),
        ))
            if (remaining.has(pointer.path)) remaining.set(pointer.path, pointer);
    }
    return [...remaining.values()];
}
/**
 * Build the tool files declared by one selected scope.
 * @param context the selected scope and repository generation inputs.
 * @param consumers the checks and tools that require each target.
 * @returns the selected tool files and fragment pointers.
 */
function buildToolFiles(context: GenerationInputs, consumers: GenerationConsumers): GeneratedFile[] {
    const targets = listToolFileTargets(context);
    const files: GeneratedFile[] = [];
    const seen = new Set<string>();
    for (const { toolFile, target, owner, pointers } of targets) {
        if (!isTargetEnabled(toolFile, context, consumers)) continue;
        if (toolFile.fragment) {
            files.push(...pointers);
            continue;
        }
        if (seen.has(target)) continue;
        seen.add(target);
        const fragmentPaths = new Set(
            targets
                .filter((entry) => entry.toolFile.fragment && entry.toolFile.target === toolFile.target)
                .flatMap((entry) => entry.pointers.map((pointer) => pointer.path)),
        );
        files.push(
            ...buildToolFile(
                { ...owner, toolFile, targetPath: target, level: context.session.settingsFile.settings.level },
                fragmentPaths,
            ),
        );
    }
    return files;
}

function listToolFileTargets(context: GenerationInputs): ToolFileTarget[] {
    const { selection } = context;
    return selection.selected.flatMap((manifest) => {
        const owner = { ...context, manifest };
        return manifest.toolFiles.map((toolFile) => {
            let target = toolFile.target;
            if (selection.scope.path !== '' && toolFile.per_scope) {
                target = toolFile.target.startsWith(TOOL_FILE_PREFIX)
                    ? join(TOOL_FILE_PREFIX, selection.scope.path, toolFile.target.slice(TOOL_FILE_PREFIX.length))
                    : join(selection.scope.path, toolFile.target);
            }
            return {
                toolFile,
                target,
                owner,
                pointers:
                    toolFile.fragment && toolFile.pointer?.directories !== undefined
                        ? buildPointerFiles(owner, toolFile, target)
                        : [],
            };
        });
    });
}

export { buildToolFiles, removeDuplicateToolFiles };
