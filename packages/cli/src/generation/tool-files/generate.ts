import { join, dirname } from 'node:path/posix';
import { buildScopeTarget } from '#cli/repository/scopes.ts';
import { buildPointerFiles } from '#cli/generation/pointers.ts';
import { emitTarget } from '#cli/generation/tool-files/build.ts';
import { TOOL_FILE_PREFIX } from '#cli/config/system/locations.ts';
import { TOOL_FILE_REFERENCE } from '#cli/config/generation/files.ts';
import { isConfigurationSelected } from '#cli/configurations/select.ts';
import type { ToolFileDeclaration } from '#cli/types/configurations.ts';

import type {
    WholeToolFile,
    GeneratedFile,
    ToolFileInputs,
    ToolFileTarget,
    GenerationResult,
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

// Emits one tool file target: its file, its nested copies, and its pointer.
function emitToolFile(
    context: ToolFileInputs,
    toolFile: WholeToolFile,
    target: string,
    generated: GenerationResult,
    fragmentPaths: ReadonlySet<string>,
): void {
    const { manifest } = context;
    const file: GeneratedFile = {
        path: target,
        content: emitTarget(`${manifest.dir}/${toolFile.source}`, target, context),
        kind: 'tool_file',
    };
    generated.files.push(
        file,
        ...buildPointerFiles(context, toolFile, target).filter(
            (pointer) => toolFile.pointer?.directories !== undefined || !fragmentPaths.has(pointer.path),
        ),
    );
}

// Sibling references keep their scopeTargets files together when one differs from the root.
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
    const groups = scopeTargets.map((entry) => [entry]);
    for (let index = 0; index < groups.length; index++) {
        const group = groups[index] as ToolFileTarget[];
        for (let other = index + 1; other < groups.length; ) {
            if (
                group.some((entry) =>
                    (groups[other] as ToolFileTarget[]).some(
                        (peer) =>
                            (references.get(entry.target) as Set<string>).has(peer.target) ||
                            (references.get(peer.target) as Set<string>).has(entry.target),
                    ),
                )
            ) {
                group.push(...(groups.splice(other, 1)[0] as ToolFileTarget[]));
                other = index + 1;
            } else other++;
        }
    }
    return groups;
}

// Remove identical root copies, then resolve retained pointers from the emitted paths.
function removeDuplicateToolFiles(scope: string, targets: ToolFileTarget[], generated: GenerationResult): void {
    const files = new Map(generated.files.map((file) => [file.path, file]));
    const scopeTargets = targets.filter(
        ({ toolFile, target }) =>
            !toolFile.fragment && toolFile.per_scope && target !== toolFile.target && files.has(target),
    );
    const groups = groupRelatedTargets(scopeTargets, files);
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
    generated.files = generated.files.filter(({ path }) => !skipped.has(path));
    const available = new Set(generated.files.map(({ path }) => path));
    for (const { toolFile, owner } of targets) {
        if (!toolFile.per_scope) continue;
        for (const pointer of buildPointerFiles(owner, toolFile, buildScopeTarget(scope, toolFile, available))) {
            const index = generated.files.findIndex(({ path }) => path === pointer.path);
            if (index !== -1) generated.files[index] = pointer;
        }
    }
}

/**
 * Emits the selected tool files in one scope, each target once across scopes.
 *
 * @param context the repository, resolved scope, and template inputs.
 * @param generated the generated destination list.
 * @param seen the targets already emitted.
 * @param consumers the applicable checks and the tools they require.
 */
export function buildToolFiles(
    context: GenerationInputs,
    generated: GenerationResult,
    seen: Set<string>,
    consumers: GenerationConsumers,
): void {
    const { selection } = context;
    const targets: ToolFileTarget[] = selection.selected.flatMap((manifest) => {
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
    for (const { toolFile, target, owner, pointers } of targets) {
        if (!isTargetEnabled(toolFile, context, consumers)) continue;
        if (toolFile.fragment) {
            generated.files.push(...pointers);
            continue;
        }
        if (seen.has(target)) continue;
        seen.add(target);
        const fragmentPaths = new Set(
            targets
                .filter((entry) => entry.toolFile.fragment && entry.toolFile.target === toolFile.target)
                .flatMap((entry) => entry.pointers.map((pointer) => pointer.path)),
        );
        emitToolFile(owner, toolFile, target, generated, fragmentPaths);
    }
    removeDuplicateToolFiles(selection.scope.path, targets, generated);
}
