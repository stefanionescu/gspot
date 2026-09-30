// The generated configuration files of one manifest in one scope, with the pointers that lead tools to them.
import { posix } from 'node:path';
import { ownedBy } from '#cli/kits/owners.ts';
import { targetInScope } from '#cli/kits/targets.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import { emitTarget } from '#cli/generation/templates.ts';
import type { ConfigurationTarget } from '#cli/types/kits.ts';
import { fragmentInputs } from '#cli/generation/fragments.ts';
import type { ScopeSelection } from '#cli/types/policy/policy.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';
import { bodyPointer, mergePointer } from '#cli/generation/pointers.ts';
import { GENERATED_JSON_KEY, PACKAGE_JSON_INDENT } from '#cli/config/generation.ts';
import type { Pointer, Generated, EmitInputs, GeneratedFile } from '#cli/types/generation.ts';

// A copied JSON pointer without the generated marker the body carries.
function copyPointerContent(content: string, pointerPath: string): string {
    if (!pointerPath.endsWith('.json')) return content;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    Reflect.deleteProperty(parsed, GENERATED_JSON_KEY);
    return `${JSON.stringify(parsed, null, PACKAGE_JSON_INDENT)}\n`;
}

// Whether a file belongs to a scope nested inside the one being emitted.
function isInChildScope(context: EmitInputs, file: TrackedFile): boolean {
    const scope = context.selection.scope.path;
    const children = context.scopes.map((entry) => entry.scope.path).filter((path) => path !== '' && path !== scope);
    return children.some(
        (child) => file.path.startsWith(`${child}/`) && (scope === '' || child.startsWith(`${scope}/`)),
    );
}

// The directories above a file that a pointer's directory patterns name, each clamped to the scope.
function pointerDirectories(scope: string, file: TrackedFile, matches: (path: string) => boolean): string[] {
    const directories: string[] = [];
    for (let directory = posix.dirname(file.path); directory !== '.'; directory = posix.dirname(directory)) {
        if (!matches(directory)) continue;
        const isOutside = scope !== '' && directory !== scope && !directory.startsWith(`${scope}/`);
        directories.push(isOutside ? scope : directory);
    }
    return directories;
}

// One pointer per directory the kit's owned files sit in, when the pointer names directories.
function directoryPointers(context: EmitInputs, configuration: ConfigurationTarget, target: string): GeneratedFile[] {
    const { files, inputs, selection, manifest } = context;
    const pointer = configuration.pointer;
    if (pointer?.directories === undefined) return [];
    const scope = selection.scope.path;
    const matches = pathMatcher(pointer.directories);
    const owned = ownedBy(manifest.owners, selection.selected, files, scope).filter(
        (file) => !isInChildScope(context, file),
    );
    const directories = new Set(owned.flatMap((file) => pointerDirectories(scope, file, matches)));
    return [...directories].map((directory) =>
        bodyPointer(pointer, `${directory}/${pointer.path}`, target, inputs.version, manifest.kit.name),
    );
}

// The pointer file at a path: a rendered template, a copy of the body, or a reference to it.
function pointerFile(
    context: EmitInputs,
    configuration: ConfigurationTarget,
    pointer: Pointer,
    file: GeneratedFile,
    path: string,
): GeneratedFile {
    const { inputs, manifest } = context;
    const base = { path, readOnly: true, kind: 'pointer', kit: manifest.kit.name } as const;
    if (pointer.template !== undefined)
        return {
            ...base,
            content: emitTarget(`${manifest.dir}/${pointer.template}`, path, inputs, configuration.header),
        };
    if (pointer.copy === true) return { ...base, content: copyPointerContent(file.content, path) };
    return bodyPointer(pointer, path, file.path, inputs.version, manifest.kit.name);
}

// Adds the pointer a configuration declares for its generated file.
function pointerFor(
    context: EmitInputs,
    configuration: ConfigurationTarget,
    file: GeneratedFile,
    plan: Generated,
): void {
    const { pointer } = configuration;
    if (!pointer) return;
    if (pointer.directories !== undefined) {
        plan.files.push(...directoryPointers(context, configuration, file.path));
        return;
    }
    const scope = configuration.per_scope ? context.selection.scope.path : '';
    const pointerPath = scope === '' ? pointer.path : `${scope}/${pointer.path}`;
    const replaced = context.selection.selected.some((owner) =>
        owner.configs.some(
            (fragment) =>
                fragment.fragment &&
                fragment.target === configuration.target &&
                directoryPointers({ ...context, manifest: owner }, fragment, file.path).some(
                    (nested) => nested.path === pointerPath,
                ),
        ),
    );
    if (replaced) return;
    if (pointer.merge) plan.merges.push(mergePointer(context.root, pointer, pointerPath, file.path));
    else plan.files.push(pointerFile(context, configuration, pointer, file, pointerPath));
}

// Scoped targets require their dependency in the same scope; repository-wide targets use the full selection.
function isWanted(configuration: ConfigurationTarget, scopes: ScopeSelection[], selection: ScopeSelection): boolean {
    if (configuration.needs === undefined) return true;
    const wanted = configuration.needs;
    const selectedScopes = configuration.per_scope ? [selection] : scopes;
    return selectedScopes.some((entry) => entry.selected.some((manifest) => manifest.kit.name === wanted));
}

// Emits one configuration target: its file, its nested copies, and its pointer.
function emitConfiguration(
    context: EmitInputs,
    configuration: ConfigurationTarget,
    target: string,
    plan: Generated,
): void {
    const { scopes, selection, manifest } = context;
    const inputs = { ...context.inputs, ...fragmentInputs(scopes, selection, configuration, context.inputs) };
    const file: GeneratedFile = {
        path: target,
        content: emitTarget(`${manifest.dir}/${configuration.template ?? ''}`, target, inputs, configuration.header),
        readOnly: true,
        kind: 'config',
        kit: manifest.kit.name,
        ...(configuration.rules_path === undefined ? {} : { rulesPath: configuration.rules_path }),
    };
    plan.files.push(file);
    pointerFor({ ...context, inputs }, configuration, file, plan);
}

/**
 * Emits every kit file of the manifest in the scope, each target once across scopes.
 * @param context the scope, the manifest, and the template inputs
 * @param plan the plan the files are added to
 * @param seen the targets already emitted
 */
export function emitConfigurations(context: EmitInputs, plan: Generated, seen: Set<string>): void {
    const { scopes, selection, manifest } = context;
    for (const configuration of manifest.configs) {
        if (!isWanted(configuration, scopes, selection)) continue;
        const target = targetInScope(selection.scope.path, configuration);
        if (configuration.fragment) {
            plan.files.push(...directoryPointers(context, configuration, target));
            continue;
        }
        if (seen.has(target) || configuration.template === undefined) continue;
        seen.add(target);
        emitConfiguration(context, configuration, target, plan);
    }
}
