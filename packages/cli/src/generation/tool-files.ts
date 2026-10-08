// The selected tool files in one scope, with the pointers that lead tools to them.
import { posix } from 'node:path';
import { emitTarget } from '#cli/generation/eta.ts';
import { collectRules } from '#cli/generation/rules.ts';
import { ownedBy } from '#cli/configurations/owners.ts';
import { bodyPointer } from '#cli/generation/pointers.ts';
import { fragmentInputs } from '#cli/generation/fragments.ts';
import type { CapturedRules } from '#cli/types/generation/rules.ts';
import { targetInScope } from '#cli/configurations/declarations.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { isConfigurationSelected } from '#cli/configurations/select.ts';
import { isInScope, pathMatcher, nestedScopes } from '#cli/repository/selectors.ts';
import type { GeneratedToolFile, ToolFileDeclaration } from '#cli/types/configurations.ts';

import type {
    Generated,
    EmitInputs,
    EmitConsumers,
    GeneratedFile,
    ToolFileInputs,
} from '#cli/types/generation/files.ts';

// The directories above a file that a pointer's directory patterns name, each clamped to the scope.
function pointerDirectories(scope: string, file: TrackedFile, matches: (path: string) => boolean): string[] {
    const directories: string[] = [];
    for (let directory = posix.dirname(file.path); directory !== '.'; directory = posix.dirname(directory)) {
        if (!matches(directory)) continue;
        const isOutside = !isInScope(directory, scope);
        directories.push(isOutside ? scope : directory);
    }
    return directories;
}

// One pointer per directory the tool file's owned files sit in, when the pointer names directories.
function directoryPointers(context: ToolFileInputs, toolFile: ToolFileDeclaration, target: string): GeneratedFile[] {
    const { files, inputs, selection, manifest } = context;
    const pointer = toolFile.pointer;
    if (pointer?.directories === undefined) return [];
    const scope = selection.scope.path;
    const children = nestedScopes(
        context.scopes.map((entry) => entry.scope.path),
        scope,
    );
    const matches = pathMatcher(pointer.directories);
    const owned = ownedBy(manifest.files, selection.selected, files, scope).filter((file) =>
        children.every((child) => !isInScope(file.path, child)),
    );
    const directories = new Set(owned.flatMap((file) => pointerDirectories(scope, file, matches)));
    return [...directories].map((directory) =>
        bodyPointer(pointer, `${directory}/${pointer.path}`, target, inputs.version),
    );
}

// Adds the pointer a tool file declares for its generated file.
function addPointer(
    context: ToolFileInputs,
    toolFile: ToolFileDeclaration,
    file: GeneratedFile,
    generated: Generated,
    fragmentPaths: ReadonlySet<string>,
): void {
    const { pointer } = toolFile;
    if (!pointer) return;
    if (pointer.directories !== undefined) {
        generated.files.push(...directoryPointers(context, toolFile, file.path));
        return;
    }
    const scope = toolFile.scoped ? context.selection.scope.path : '';
    const pointerPath = scope === '' ? pointer.path : `${scope}/${pointer.path}`;
    // A fragment's directory pointer includes its native overrides and must keep precedence over the base pointer.
    const isWrittenByFragment = fragmentPaths.has(pointerPath);
    if (isWrittenByFragment) return;
    const { inputs, manifest } = context;
    const pointed =
        pointer.template === undefined
            ? bodyPointer(pointer, pointerPath, file.path, inputs.version)
            : {
                  path: pointerPath,
                  kind: 'pointer' as const,
                  content: emitTarget(
                      `${manifest.dir}/${pointer.template}`,
                      pointerPath,
                      inputs,
                      toolFile.generated_header,
                  ),
              };
    generated.files.push(pointed);
}

function isConditionMet(
    toolFile: ToolFileDeclaration,
    context: EmitInputs,
    condition: ToolFileDeclaration['when'],
): boolean {
    if (condition === undefined) return true;
    return isConfigurationSelected(toolFile.scoped ? [context.selection] : context.scopes, condition.configuration);
}

// Scoped targets require their dependency in the same scope; repository-wide targets use the full selection.
function isTargetEnabled(toolFile: ToolFileDeclaration, context: EmitInputs, consumers: EmitConsumers): boolean {
    const needed = toolFile.scoped ? consumers.scope : consumers.repository;
    const constraints = [
        [toolFile.tool, needed.tools],
        [toolFile.check, needed.checks],
    ] as const;
    if (constraints.some(([names, available]) => names.length > 0 && !names.some((name) => available.has(name))))
        return false;
    return isConditionMet(toolFile, context, toolFile.when);
}

// Emits one tool file target: its file, its nested copies, and its pointer.
function emitToolFile(
    context: ToolFileInputs,
    toolFile: GeneratedToolFile,
    target: string,
    generated: Generated,
    fragmentPaths: ReadonlySet<string>,
): void {
    const { scopes, selection, manifest } = context;
    const payload: CapturedRules = {};
    const paths = toolFile.rule_keys;
    const capture = { recorded: false };
    const inputs = {
        ...context.inputs,
        ...(paths === undefined
            ? {}
            : {
                  recordRules: (document: unknown) => {
                      Object.assign(payload, collectRules(paths, document));
                      capture.recorded = true;
                  },
              }),
    };
    Object.assign(inputs, fragmentInputs(scopes, selection, toolFile, inputs));
    const file: GeneratedFile = {
        path: target,
        content: emitTarget(`${manifest.dir}/${toolFile.source}`, target, inputs, toolFile.generated_header),
        kind: 'tool_file',
        ...(paths === undefined ? {} : { ruleData: payload }),
    };
    if (paths !== undefined && !capture.recorded)
        throw new Error(`The Eta source for ${target} did not provide its declared rule data.`);
    generated.files.push(file);
    if (isConditionMet(toolFile, context, toolFile.pointer?.when))
        addPointer({ ...context, inputs }, toolFile, file, generated, fragmentPaths);
}

/**
 * Emits the selected tool files in one scope, each target once across scopes.
 * @param context the repository, resolved scope, and template inputs
 * @param generated the generated the files are added to
 * @param seen the targets already emitted
 * @param consumers the applicable checks and the tools they require
 */
export function emitToolFiles(
    context: EmitInputs,
    generated: Generated,
    seen: Set<string>,
    consumers: EmitConsumers,
): void {
    const { selection } = context;
    const targets = selection.selected.flatMap((manifest) => {
        const owner = { ...context, manifest };
        return manifest.toolFiles.map((toolFile) => ({
            toolFile,
            owner,
            pointers: toolFile.fragment
                ? directoryPointers(owner, toolFile, targetInScope(selection.scope.path, toolFile))
                : [],
        }));
    });
    for (const { toolFile, owner, pointers } of targets) {
        if (!isTargetEnabled(toolFile, context, consumers)) continue;
        const target = targetInScope(selection.scope.path, toolFile);
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
}
