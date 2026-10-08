// The selected tool files in one scope, with the pointers that lead tools to them.
import { fragmentInputs } from '#cli/generation/fragments.ts';
import { targetInScope } from '#cli/configurations/contracts.ts';
import { emitTarget } from '#cli/generation/compilation/public.ts';
import type { CapturedRules } from '#cli/types/generation/rules.ts';
import { isConfigurationSelected } from '#cli/configurations/public.ts';
import type { GeneratedToolFile, ToolFileDeclaration } from '#cli/types/configurations.ts';
import { fillTarget, bodyPointer, collectRules, pointerPaths } from '#cli/generation/documents/contracts.ts';

import type {
    Generated,
    EmitInputs,
    EmitConsumers,
    GeneratedFile,
    ToolFileInputs,
} from '#cli/types/generation/files.ts';

// Root and directory pointers share native body or Eta emission with target placeholders.
function pointerFiles(context: ToolFileInputs, toolFile: ToolFileDeclaration, target: string): GeneratedFile[] {
    const { pointer } = toolFile;
    const { inputs, manifest } = context;
    if (pointer === undefined) return [];
    return pointerPaths(context, toolFile).map((path) =>
        pointer.template === undefined
            ? bodyPointer(pointer, path, target, inputs.version)
            : {
                  path,
                  kind: 'pointer',
                  content: fillTarget(
                      emitTarget(`${manifest.dir}/${pointer.template}`, path, inputs, toolFile.generated_header),
                      path,
                      target,
                  ),
              },
    );
}

// Scoped targets require their dependency in the same scope; repository-wide targets use the full selection.
function isTargetEnabled(toolFile: ToolFileDeclaration, context: EmitInputs, consumers: EmitConsumers): boolean {
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
    generated.files.push(
        file,
        ...pointerFiles({ ...context, inputs }, toolFile, target).filter(
            (pointer) => toolFile.pointer?.directories !== undefined || !fragmentPaths.has(pointer.path),
        ),
    );
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
            pointers:
                toolFile.fragment && toolFile.pointer?.directories !== undefined
                    ? pointerFiles(owner, toolFile, targetInScope(selection.scope.path, toolFile))
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
