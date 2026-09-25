import { assembleRules } from '#cli/agents/assemble.ts';
import { agentFiles, managedBlock } from '#cli/agents/instructions.ts';
import { claimedByClaims } from '#cli/configurations/claims.ts';
import type { Manifest } from '#cli/configurations/manifests.ts';
import type { ConfigurationTarget, FragmentSelector } from '#cli/configurations/schema.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import { targetInScope } from '#cli/configurations/targets.ts';
import { bunConfiguration } from '#cli/generation/bun.ts';
import type { ResolvedSelector, SelectorGroup } from '#cli/generation/eslint.ts';
import { selectorGroups } from '#cli/generation/eslint.ts';
import { huskyLines, lefthookConfiguration } from '#cli/generation/hooks.ts';
import { GENERATED_JSON_KEY } from '#cli/generation/json-format.ts';
import { gitignoreBlock } from '#cli/generation/managed-blocks.ts';
import { preCommitConfiguration } from '#cli/generation/pre-commit.ts';
import { miseTasks } from '#cli/generation/runner-tasks.ts';
import { simpleGitHookOutputs } from '#cli/generation/simple-git-hooks.ts';
import { bodyStub, mergeStub } from '#cli/generation/stubs.ts';
import type { TemplateInputs } from '#cli/generation/templates.ts';
import { emitTarget, eta, templateInputs } from '#cli/generation/templates.ts';
import { toolEnvironment } from '#cli/generation/tool-environment.ts';
import { toolPackages } from '#cli/generation/tool-packages.ts';
import { styleFiles } from '#cli/generation/vale-styles.ts';
import { gitlabFile, workflowFile } from '#cli/generation/workflow.ts';
import type { GeneratedFile, GeneratedProposal } from '#cli/lifecycle/apply.ts';
import { applyBlock } from '#cli/lifecycle/managed-blocks.ts';
import { retainedConfigurationPaths } from '#cli/lifecycle/retained-config.ts';
import { runnerTaskPlan } from '#cli/lifecycle/runner-tasks.ts';
import { binaryPath, readAsset } from '#cli/platform/assets.ts';
import type { FileSnapshot } from '#cli/platform/filesystem.ts';
import { mutationTarget } from '#cli/platform/filesystem.ts';
import type { MergedView } from '#cli/policy/merge.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import type { ScopeSelection } from '#cli/policy/resolve.ts';
import type { EditorconfigAdoption } from '#cli/policy/schema.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import type { Repository } from '#cli/repository/tree.ts';
import type { ToolPackageManager } from '#cli/tools/packages/manager.ts';
import { posix } from 'node:path';

const JSON_INDENT = 4;

function copyStubContent(content: string, stubPath: string): string {
    if (!stubPath.endsWith('.json')) return content;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    Reflect.deleteProperty(parsed, GENERATED_JSON_KEY);
    return `${JSON.stringify(parsed, null, JSON_INDENT)}\n`;
}

function pathInScope(scope: string, path: string): string {
    return scope === '' ? path : `${scope}/${path}`;
}

function directoryStubs(context: EmitContext, config: ConfigurationTarget, target: string): GeneratedFile[] {
    const { scopes, files, inputs, selection, manifest } = context;
    const stub = config.stub;
    if (stub?.directories === undefined) return [];
    const scope = selection.scope.path;
    const children = scopes.map((entry) => entry.scope.path).filter((path) => path !== '' && path !== scope);
    const matches = pathMatcher(stub.directories);
    const directories = new Set<string>();
    for (const file of claimedByClaims(manifest.claims, selection.selected, files, scope)) {
        if (
            children.some(
                (child) => file.path.startsWith(`${child}/`) && (scope === '' || child.startsWith(`${scope}/`)),
            )
        )
            continue;
        for (let directory = posix.dirname(file.path); directory !== '.'; directory = posix.dirname(directory)) {
            if (matches(directory))
                directories.add(
                    scope !== '' && directory !== scope && !directory.startsWith(`${scope}/`) ? scope : directory,
                );
        }
    }
    return [...directories].map((directory) =>
        bodyStub(stub, `${directory}/${stub.path}`, target, inputs.version, manifest.configuration.name),
    );
}

// The configurations whose fragments a target takes: a target written for one scope asks that scope, and a target written once asks every scope.
function fragmentOwners(scopes: ScopeSelection[], selection: ScopeSelection, owner: ConfigurationTarget): Manifest[] {
    if (owner.per_scope) return selection.selected;
    const every = [selection, ...scopes].flatMap((entry) => entry.selected);
    return new Map(every.map((manifest) => [manifest.configuration.name, manifest])).values().toArray();
}

function fragmentsFor(
    scopes: ScopeSelection[],
    selection: ScopeSelection,
    owner: ConfigurationTarget,
    inputs: TemplateInputs,
): string {
    return fragmentOwners(scopes, selection, owner)
        .flatMap((manifest) =>
            manifest.configs
                .filter((fragment) => fragment.fragment && fragment.target === owner.target)
                .flatMap((fragment) =>
                    fragment.template === undefined
                        ? []
                        : [eta.renderString(readAsset(`${manifest.dir}/${fragment.template}`), inputs)],
                ),
        )
        .join('\n');
}

// The fragment entries of a target across its owners, in configuration order.
function fragmentEntries(scopes: ScopeSelection[], selection: ScopeSelection, owner: ConfigurationTarget) {
    return fragmentOwners(scopes, selection, owner).flatMap((manifest) =>
        manifest.configs.filter((fragment) => fragment.fragment && fragment.target === owner.target),
    );
}

// The file globs the selected fragments add to the code files of a target, each once.
function fragmentFilesFor(scopes: ScopeSelection[], selection: ScopeSelection, owner: ConfigurationTarget): string[] {
    return [...new Set(fragmentEntries(scopes, selection, owner).flatMap((fragment) => fragment.code_files))];
}

// The paths a loosening setting allows: every entry's paths, in the order written.
function allowedPaths(selection: ScopeSelection, setting: string): string[] {
    const value = selection.view.settings[setting];
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry: unknown) => {
        const paths = typeof entry === 'object' && entry !== null ? (entry as { paths?: unknown }).paths : undefined;
        return Array.isArray(paths) ? paths.filter((path): path is string => typeof path === 'string') : [];
    });
}

// The selectors the selected fragments add, grouped by the file set each one applies to.
function fragmentSelectorsFor(
    scopes: ScopeSelection[],
    selection: ScopeSelection,
    owner: ConfigurationTarget,
): SelectorGroup[] {
    const resolved = fragmentEntries(scopes, selection, owner).flatMap((fragment) =>
        fragment.selectors.map(
            (entry: FragmentSelector): ResolvedSelector => ({
                selector: entry.selector,
                message: entry.message,
                ...(entry.files === undefined ? {} : { files: entry.files }),
                ...(entry.allowed === undefined ? {} : { except: allowedPaths(selection, entry.allowed) }),
            }),
        ),
    );
    return selectorGroups(resolved);
}

// The import lines the selected fragments declare, each once, in configuration order.
function fragmentImportsFor(scopes: ScopeSelection[], selection: ScopeSelection, owner: ConfigurationTarget): string {
    const lines = fragmentOwners(scopes, selection, owner).flatMap((manifest) =>
        manifest.configs
            .filter(
                (fragment) => fragment.fragment && fragment.target === owner.target && fragment.imports !== undefined,
            )
            .flatMap((fragment) => readAsset(`${manifest.dir}/${fragment.imports!}`).split('\n'))
            .filter((line) => line.trim() !== ''),
    );
    return [...new Set(lines)].join('\n');
}

function stubFor(context: EmitContext, config: ConfigurationTarget, file: GeneratedFile, out: GeneratedProposal): void {
    const { root, inputs, selection, manifest } = context;
    const { stub } = config;
    if (!stub) return;
    if (stub.directories !== undefined) {
        out.files.push(...directoryStubs(context, config, file.path));
        return;
    }
    const stubPath = pathInScope(config.per_scope ? selection.scope.path : '', stub.path);
    const replaced = selection.selected.some((owner) =>
        owner.configs.some(
            (fragment) =>
                fragment.fragment &&
                fragment.target === config.target &&
                directoryStubs({ ...context, manifest: owner }, fragment, file.path).some(
                    (nested) => nested.path === stubPath,
                ),
        ),
    );
    if (replaced) return;
    if (stub.merge) out.merges.push(mergeStub(root, stub, stubPath, file.path));
    else if (stub.template !== undefined)
        out.files.push({
            path: stubPath,
            content: emitTarget(`${manifest.dir}/${stub.template}`, stubPath, inputs, config.header),
            readOnly: true,
            kind: 'stub',
            configuration: manifest.configuration.name,
        });
    else if (stub.copy === true)
        out.files.push({
            path: stubPath,
            content: copyStubContent(file.content, stubPath),
            readOnly: true,
            kind: 'stub',
            configuration: manifest.configuration.name,
        });
    else out.files.push(bodyStub(stub, stubPath, file.path, inputs.version, manifest.configuration.name));
}

// Scoped targets require their dependency in the same scope; repository-wide targets use the full selection.
function isWanted(config: ConfigurationTarget, scopes: ScopeSelection[], selection: ScopeSelection): boolean {
    if (config.needs === undefined) return true;
    const wanted = config.needs;
    const selectedScopes = config.per_scope ? [selection] : scopes;
    return selectedScopes.some((entry) => entry.selected.some((manifest) => manifest.configuration.name === wanted));
}

function configurationFiles(context: EmitContext, out: GeneratedProposal, seen: Set<string>): void {
    const { scopes, selection, manifest } = context;
    for (const config of manifest.configs) {
        if (!isWanted(config, scopes, selection)) continue;
        const target = targetInScope(selection.scope.path, config);
        if (config.fragment) {
            out.files.push(...directoryStubs(context, config, target));
            continue;
        }
        if (seen.has(target) || config.template === undefined) continue;
        seen.add(target);
        const inputs = {
            ...context.inputs,
            fragments: fragmentsFor(scopes, selection, config, context.inputs),
            fragmentImports: fragmentImportsFor(scopes, selection, config),
            fragmentFiles: fragmentFilesFor(scopes, selection, config),
            fragmentSelectors: fragmentSelectorsFor(scopes, selection, config),
        };
        if (config.per_scope) inputs.has = (configuration) => selection.view.configurations.includes(configuration);
        const file: GeneratedFile = {
            path: target,
            content: emitTarget(`${manifest.dir}/${config.template}`, target, inputs, config.header),
            readOnly: true,
            kind: 'config',
            configuration: manifest.configuration.name,
            ...(config.rules_path === undefined ? {} : { rulesPath: config.rules_path }),
        };
        out.files.push(file);
        if (manifest.configuration.name === 'formatting' && config.target === '.editorconfig') {
            const adopted = selection.view.tool('editorconfig')['adopted'] as EditorconfigAdoption | undefined;
            for (const directory of adopted?.directories ?? []) {
                const path = `${directory.basePath}/.editorconfig`;
                const nestedInputs = {
                    ...inputs,
                    tool: (name: string) => (name === 'editorconfig' ? { adopted: directory } : inputs.tool(name)),
                };
                out.files.push({
                    ...file,
                    path,
                    content: emitTarget(`${manifest.dir}/${config.template}`, path, nestedInputs, config.header),
                });
            }
        }
        stubFor({ ...context, inputs }, config, file, out);
    }
}

function hookOutputs(root: string, policy: Policy, out: GeneratedProposal, binary: string | undefined): void {
    const runner = policy.runner?.tool;
    switch (policy.hooks?.tool) {
        case 'gspot': {
            break;
        }
        case 'pre-commit': {
            out.configurations.push(preCommitConfiguration(root, runner, binary));
            break;
        }
        case 'simple-git-hooks': {
            simpleGitHookOutputs(root, policy.runner?.tool, out, binary);
            break;
        }
        case 'husky': {
            for (const line of huskyLines(root, runner, binary))
                out.blocks.push({ path: line.path, block: line.line, style: 'hash' });
            break;
        }
        case 'lefthook': {
            out.configurations.push(lefthookConfiguration(root, runner, binary));
            break;
        }
        // No default
    }
}

function runnerOutputs(
    root: string,
    policy: Policy,
    manifests: Manifest[],
    version: string,
    hasPackageManager: boolean,
    out: GeneratedProposal,
): void {
    const runner = policy.runner?.tool;
    if (runner === undefined) return;
    const plan = runnerTaskPlan(root, runner, policy.runner?.tasks);
    out.notes.push(...plan.notes);
    if (runner === 'mise') out.files.push(miseTasks(manifests, version, hasPackageManager, plan.tasks));
    if (plan.configuration !== undefined) out.configurations.push(plan.configuration);
}

function workflowOutput(policy: Policy, scopes: ScopeSelection[], version: string, out: GeneratedProposal): void {
    if (policy.ci === undefined) return;
    const swiftScope = scopes.find((selection) =>
        selection.selected.some((manifest) => manifest.configuration.name === 'swift'),
    );
    out.files.push(
        (policy.ci.provider === 'github' ? workflowFile : gitlabFile)({
            version,
            run: policy.ci.run,
            sarif: policy.ci.sarif,
            platforms: policy.ci.platforms,
            swiftScope: swiftScope?.scope.path,
            isMise: policy.runner?.tool === 'mise',
        }),
    );
}

function rootView(scopes: ScopeSelection[]): MergedView {
    const root = scopes.find((selection) => selection.scope.path === '') ?? scopes[0];
    if (root === undefined) throw new Error('The session has no scope.');
    return root.view;
}

function blockOutputs(
    root: string,
    policy: Policy,
    manifests: Manifest[],
    hasGit: boolean,
    out: GeneratedProposal,
): void {
    if (hasGit) out.blocks.push({ path: '.gitignore', block: gitignoreBlock(), style: 'hash' });
    out.blocks.push({
        path: '.gitattributes',
        block: '.gspot/** linguist-generated\n.gspot/** text eol=lf',
        style: 'hash',
    });
    if (!policy.rules.install) return;
    const block = managedBlock(policy.rules, manifests);
    for (const path of agentFiles(root, policy.rules.agents)) {
        if (path === '.cursor/rules/gspot.mdc') {
            out.files.push({
                path,
                content: `---\ndescription: Repository engineering rules\nalwaysApply: true\n---\n\n${applyBlock('', block, 'markdown')}`,
                readOnly: false,
                kind: 'rules',
            });
        } else out.blocks.push({ path, block, style: 'markdown' });
    }
}

function combineConfigurations(proposal: GeneratedProposal): void {
    const combined = new Map<string, GeneratedProposal['configurations'][number]>();
    for (const output of proposal.configurations) {
        const previous = combined.get(output.path);
        if (previous === undefined) combined.set(output.path, { ...output, changes: [...output.changes] });
        else {
            if (previous.format !== output.format)
                throw new Error(`Generated configuration formats conflict: ${output.path}`);
            previous.changes.push(...output.changes);
        }
    }
    proposal.configurations = [...combined.values()];
}

function validateProposal(proposal: GeneratedProposal): void {
    const paths = new Map<string, string>();
    const outputs = [...proposal.files, ...proposal.blocks, ...proposal.merges, ...proposal.configurations];
    for (const output of outputs) {
        mutationTarget(output.path);
        const key = output.path.normalize('NFC').toLowerCase();
        const previous = paths.get(key);
        if (previous !== undefined) throw new Error(`Generated destinations collide: ${previous} and ${output.path}`);
        paths.set(key, output.path);
    }
}

/**
 * Renders proposed files in memory while retaining observations at the caller’s lifecycle lock boundary.
 * @param policy
 * @param repository
 * @param scopes
 * @param options
 * @returns the files, blocks, merges and package edits
 */
export function emitAll(
    policy: Policy,
    repository: Repository,
    scopes: ScopeSelection[],
    options: GenerationOptions,
): GeneratedProposal {
    const { root, files, hasGit } = repository;
    const { version, packageManager, takeover } = options;
    const manifests = everyManifest(scopes);
    const binary = binaryPath();
    const out: GeneratedProposal = { notes: [], files: [], blocks: [], merges: [], configurations: [] };
    const seen = new Set<string>();
    for (const selection of scopes) {
        const inputs = templateInputs(root, policy, files, scopes, selection, version);
        for (const manifest of selection.selected)
            configurationFiles({ root, files, scopes, inputs, selection, manifest }, out, seen);
    }
    if (out.files.some((file) => file.configuration === 'formatting')) {
        const retained = retainedConfigurationPaths(
            root,
            files.filter((file) => file.nature === 'source').map((file) => file.path),
            ['prettier', 'ec'],
            takeover,
        );
        if (retained.length > 0) {
            const adopted = policy.tools['editorconfig']?.['adopted'] as EditorconfigAdoption | undefined;
            const editorconfigs = new Set(
                adopted === undefined
                    ? []
                    : [
                          '.editorconfig',
                          ...(adopted.directories ?? []).map((directory) => `${directory.basePath}/.editorconfig`),
                      ],
            );
            out.files = out.files.filter(
                (file) =>
                    file.configuration !== 'formatting' ||
                    file.path.startsWith('.gspot/') ||
                    editorconfigs.has(file.path) ||
                    retained.every((path) => posix.dirname(path) !== posix.dirname(file.path)),
            );
            out.notes.push(
                ...retained.map(
                    (path) =>
                        `retained ${path}: editor configuration remains active; gspot checks use generated policy`,
                ),
            );
        }
    }
    if (out.files.some((file) => file.path === '.gspot/config/eslint.config.mjs')) {
        const retained = retainedConfigurationPaths(
            root,
            files.filter((file) => file.nature === 'source').map((file) => file.path),
            ['eslint'],
            takeover,
        );
        if (retained.length > 0) {
            out.files = out.files.filter((file) => file.path !== 'eslint.config.mjs');
            out.notes.push(
                ...retained.map(
                    (path) =>
                        `retained ${path}: authored ESLint configuration remains active; gspot checks use generated policy`,
                ),
            );
        }
    }
    out.configurations.push(...bunConfiguration(root, scopes));
    hookOutputs(root, policy, out, binary);
    out.files.push(...toolPackages(manifests, packageManager, policy.runner?.tool), ...toolEnvironment(manifests));
    runnerOutputs(root, policy, manifests, version, packageManager !== undefined, out);
    workflowOutput(policy, scopes, version, out);
    out.files.push(...assembleRules(policy.rules, manifests));
    if (scopes.some((selection) => selection.selected.some((manifest) => manifest.configuration.name === 'prose')))
        out.files.push(...styleFiles(policy, rootView(scopes)));
    blockOutputs(root, policy, manifests, hasGit, out);
    out.files.sort((a, b) => a.path.localeCompare(b.path));
    combineConfigurations(out);
    validateProposal(out);
    return out;
}

type EmitContext = {
    root: string;
    files: TrackedFile[];
    scopes: ScopeSelection[];
    inputs: TemplateInputs;
    selection: ScopeSelection;
    manifest: Manifest;
};

export type GenerationOptions = {
    version: string;
    packageManager: ToolPackageManager | undefined;
    takeover?: ReadonlyMap<string, FileSnapshot> | undefined;
};
