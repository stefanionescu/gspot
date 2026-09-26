// The generated configuration files of one manifest in one scope, with the pointers that lead tools to them.
import { posix } from 'node:path';
import { pathMatcher } from '#cli/repository/paths.ts';
import { emitTarget } from '#cli/generation/templates.ts';
import { fragmentInputs } from '#cli/generation/fragments.ts';
import { targetInScope } from '#cli/configurations/targets.ts';
import { claimedByClaims } from '#cli/configurations/claims.ts';
import { GENERATED_JSON_KEY } from '#cli/generation/json-format.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';
import type { ConfigurationTarget } from '#cli/types/configurations.ts';
import { bodyPointer, mergePointer } from '#cli/generation/pointers.ts';
import type { EditorconfigAdoption, ScopeSelection } from '#cli/types/policy/policy.ts';
import type { EmitContext, Pointer, GeneratedFile, GeneratedProposal } from '#cli/types/generation.ts';

const JSON_INDENT = 4;

// A copied JSON pointer without the generated marker the body carries.
function copyPointerContent(content: string, pointerPath: string): string {
    if (!pointerPath.endsWith('.json')) return content;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    Reflect.deleteProperty(parsed, GENERATED_JSON_KEY);
    return `${JSON.stringify(parsed, null, JSON_INDENT)}\n`;
}

function pathInScope(scope: string, path: string): string {
    return scope === '' ? path : `${scope}/${path}`;
}

// Whether a file belongs to a scope nested inside the one being emitted.
function isInChildScope(context: EmitContext, file: TrackedFile): boolean {
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

// One pointer per directory the configuration's claimed files sit in, when the pointer names directories.
function directoryPointers(context: EmitContext, config: ConfigurationTarget, target: string): GeneratedFile[] {
    const { files, inputs, selection, manifest } = context;
    const pointer = config.pointer;
    if (pointer?.directories === undefined) return [];
    const scope = selection.scope.path;
    const matches = pathMatcher(pointer.directories);
    const claimed = claimedByClaims(manifest.claims, selection.selected, files, scope).filter(
        (file) => !isInChildScope(context, file),
    );
    const directories = new Set(claimed.flatMap((file) => pointerDirectories(scope, file, matches)));
    return [...directories].map((directory) =>
        bodyPointer(pointer, `${directory}/${pointer.path}`, target, inputs.version, manifest.configuration.name),
    );
}

// Whether a fragment of the target writes a directory pointer at the same path, which then stands in for this one.
function isReplacedByFragment(
    context: EmitContext,
    config: ConfigurationTarget,
    file: GeneratedFile,
    path: string,
): boolean {
    return context.selection.selected.some((owner) =>
        owner.configs.some(
            (fragment) =>
                fragment.fragment &&
                fragment.target === config.target &&
                directoryPointers({ ...context, manifest: owner }, fragment, file.path).some(
                    (nested) => nested.path === path,
                ),
        ),
    );
}

// The pointer file at a path: a rendered template, a copy of the body, or a reference to it.
function pointerFile(
    context: EmitContext,
    config: ConfigurationTarget,
    pointer: Pointer,
    file: GeneratedFile,
    path: string,
): GeneratedFile {
    const { inputs, manifest } = context;
    const base = { path, readOnly: true, kind: 'pointer', configuration: manifest.configuration.name } as const;
    if (pointer.template !== undefined)
        return { ...base, content: emitTarget(`${manifest.dir}/${pointer.template}`, path, inputs, config.header) };
    if (pointer.copy === true) return { ...base, content: copyPointerContent(file.content, path) };
    return bodyPointer(pointer, path, file.path, inputs.version, manifest.configuration.name);
}

// Adds the pointer a configuration declares for its generated file.
function pointerFor(
    context: EmitContext,
    config: ConfigurationTarget,
    file: GeneratedFile,
    out: GeneratedProposal,
): void {
    const { pointer } = config;
    if (!pointer) return;
    if (pointer.directories !== undefined) {
        out.files.push(...directoryPointers(context, config, file.path));
        return;
    }
    const pointerPath = pathInScope(config.per_scope ? context.selection.scope.path : '', pointer.path);
    if (isReplacedByFragment(context, config, file, pointerPath)) return;
    if (pointer.merge) out.merges.push(mergePointer(context.root, pointer, pointerPath, file.path));
    else out.files.push(pointerFile(context, config, pointer, file, pointerPath));
}

// Scoped targets require their dependency in the same scope; repository-wide targets use the full selection.
function isWanted(config: ConfigurationTarget, scopes: ScopeSelection[], selection: ScopeSelection): boolean {
    if (config.needs === undefined) return true;
    const wanted = config.needs;
    const selectedScopes = config.per_scope ? [selection] : scopes;
    return selectedScopes.some((entry) => entry.selected.some((manifest) => manifest.configuration.name === wanted));
}

// One .editorconfig per adopted directory, rendered as if that directory's adoption were the whole one.
function nestedEditorconfigs(context: EmitContext, config: ConfigurationTarget, file: GeneratedFile): GeneratedFile[] {
    const { manifest, selection, inputs } = context;
    if (manifest.configuration.name !== 'formatting' || config.target !== '.editorconfig') return [];
    const adopted = selection.view.tool('editorconfig')['adopted'] as EditorconfigAdoption | undefined;
    return (adopted?.directories ?? []).map((directory) => {
        const path = `${directory.basePath}/.editorconfig`;
        const nestedInputs = {
            ...inputs,
            tool: (name: string) => (name === 'editorconfig' ? { adopted: directory } : inputs.tool(name)),
        };
        return {
            ...file,
            path,
            content: emitTarget(`${manifest.dir}/${config.template ?? ''}`, path, nestedInputs, config.header),
        };
    });
}

// Emits one configuration target: its file, its nested copies, and its pointer.
function emitConfiguration(
    context: EmitContext,
    config: ConfigurationTarget,
    target: string,
    out: GeneratedProposal,
): void {
    const { scopes, selection, manifest } = context;
    const inputs = { ...context.inputs, ...fragmentInputs(scopes, selection, config, context.inputs) };
    const file: GeneratedFile = {
        path: target,
        content: emitTarget(`${manifest.dir}/${config.template ?? ''}`, target, inputs, config.header),
        readOnly: true,
        kind: 'config',
        configuration: manifest.configuration.name,
        ...(config.rules_path === undefined ? {} : { rulesPath: config.rules_path }),
    };
    const withInputs = { ...context, inputs };
    out.files.push(file, ...nestedEditorconfigs(withInputs, config, file));
    pointerFor(withInputs, config, file, out);
}

/**
 * Emits every configuration file of the manifest in the scope, each target once across scopes.
 * @param context the scope, the manifest, and the template inputs
 * @param out the proposal the files are added to
 * @param seen the targets already emitted
 */
export function configurationFiles(context: EmitContext, out: GeneratedProposal, seen: Set<string>): void {
    const { scopes, selection, manifest } = context;
    for (const config of manifest.configs) {
        if (!isWanted(config, scopes, selection)) continue;
        const target = targetInScope(selection.scope.path, config);
        if (config.fragment) {
            out.files.push(...directoryPointers(context, config, target));
            continue;
        }
        if (seen.has(target) || config.template === undefined) continue;
        seen.add(target);
        emitConfiguration(context, config, target, out);
    }
}
