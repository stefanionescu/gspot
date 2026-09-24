import { posix } from 'node:path';
import { styleFiles } from '#cli/prose/vale.ts';
import { bunConfiguration } from '#cli/emit/bun.ts';
import { assembleRules } from '#cli/agents/assemble.ts';
import { targetInScope } from '#cli/run/scope-paths.ts';
import { bodyStub, mergeStub } from '#cli/emit/stubs.ts';
import { GENERATED_JSON_KEY } from '#cli/emit/markers.ts';
import { toolPackages } from '#cli/emit/tool-packages.ts';
import type { FileSnapshot } from '#cli/types/filesystem.ts';
import { mutationTarget } from '#cli/filesystem/confined.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import { binaryPath, readAsset } from '#cli/platform/assets.ts';
import { toolEnvironment } from '#cli/emit/tool-environment.ts';
import { preCommitConfiguration } from '#cli/emit/pre-commit.ts';
// Every generated file for the selection: path, template, stub; the managed blocks and the merge stubs beside them.
import { workflowFile, gitlabFile } from '#cli/emit/workflow.ts';
import { simpleGitHookOutputs } from '#cli/emit/simple-git-hooks.ts';
import { miseTasks, runnerTaskPlan } from '#cli/emit/runner-tasks.ts';
import type { ScopeSelection, Session } from '#cli/types/execution.ts';
import { agentFiles, managedBlock } from '#cli/agents/instructions.ts';
import { huskyLines, lefthookConfiguration } from '#cli/emit/hooks.ts';
import { applyBlock, gitignoreBlock } from '#cli/emit/managed-blocks.ts';
import { emitTarget, eta, templateInputs } from '#cli/emit/templates.ts';
import { retainedConfigurationPaths } from '#cli/emit/retained-config.ts';
import type { MergedView, EditorconfigAdoption } from '#cli/types/policy.ts';
import { claimedByClaims, pathMatcher } from '#cli/configurations/claims.ts';
import type { ConfigurationTarget, Manifest } from '#cli/types/configurations.ts';
import type { EmitContext, GeneratedFile, GeneratedProposal, TemplateInputs } from '#cli/types/generation.ts';

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
    const { session, selection, manifest } = context;
    const stub = config.stub;
    if (stub?.directories === undefined) return [];
    const scope = selection.scope.path;
    const children = session.scopes.map((entry) => entry.scope.path).filter((path) => path !== '' && path !== scope);
    const matches = pathMatcher(stub.directories);
    const directories = new Set<string>();
    for (const file of claimedByClaims(manifest.claims, selection.selected, session.repository.files, scope)) {
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
        bodyStub(stub, `${directory}/${stub.path}`, target, session.version, manifest.configuration.name),
    );
}

// The configurations whose fragments a target takes: a target written for one scope asks that scope, and a target written once asks every scope.
function fragmentOwners(session: Session, selection: ScopeSelection, owner: ConfigurationTarget): Manifest[] {
    if (owner.per_scope) return selection.selected;
    const every = [selection, ...session.scopes].flatMap((entry) => entry.selected);
    return new Map(every.map((manifest) => [manifest.configuration.name, manifest])).values().toArray();
}

function fragmentsFor(session: Session, selection: ScopeSelection, owner: ConfigurationTarget): string {
    return fragmentOwners(session, selection, owner)
        .flatMap((manifest) =>
            manifest.configs
                .filter((fragment) => fragment.fragment && fragment.target === owner.target)
                .map((fragment) =>
                    eta.renderString(
                        readAsset(`${manifest.dir}/${fragment.template}`),
                        templateInputs(session, selection),
                    ),
                ),
        )
        .join('\n');
}

function stubFor(
    context: EmitContext,
    config: ConfigurationTarget,
    file: GeneratedFile,
    out: GeneratedProposal,
    inputs: TemplateInputs,
): void {
    const { session, selection, manifest } = context;
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
                directoryStubs({ session, selection, manifest: owner }, fragment, file.path).some(
                    (nested) => nested.path === stubPath,
                ),
        ),
    );
    if (replaced) return;
    if (stub.merge) out.merges.push({ ...mergeStub(session.root, stub, stubPath, file.path), target: file.path, stub });
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
    else out.files.push(bodyStub(stub, stubPath, file.path, session.version, manifest.configuration.name));
}

// Scoped targets require their dependency in the same scope; repository-wide targets use the full selection.
function isWanted(config: ConfigurationTarget, session: Session, selection: ScopeSelection): boolean {
    if (config.needs === undefined) return true;
    const wanted = config.needs;
    const scopes = config.per_scope ? [selection] : session.scopes;
    return scopes.some((entry) => entry.selected.some((manifest) => manifest.configuration.name === wanted));
}

function configurationFiles(
    session: Session,
    selection: ScopeSelection,
    manifest: Manifest,
    out: GeneratedProposal,
    seen: Set<string>,
): void {
    for (const config of manifest.configs) {
        if (!isWanted(config, session, selection)) continue;
        const target = targetInScope(selection.scope.path, config);
        if (config.fragment) {
            out.files.push(...directoryStubs({ session, selection, manifest }, config, target));
            continue;
        }
        if (seen.has(target)) continue;
        seen.add(target);
        const inputs = templateInputs(session, selection, fragmentsFor(session, selection, config));
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
        stubFor({ session, selection, manifest }, config, file, out, inputs);
    }
}

function hookOutputs(session: Session, out: GeneratedProposal, binary: string | undefined): void {
    const { policy } = session.policyFiles;
    const runner = policy.runner?.tool;
    switch (policy.hooks?.tool) {
        case 'gspot': {
            break;
        }
        case 'pre-commit': {
            out.configurations.push(preCommitConfiguration(session.root, runner, binary));
            break;
        }
        case 'simple-git-hooks': {
            simpleGitHookOutputs(session, out, binary);
            break;
        }
        case 'husky': {
            for (const line of huskyLines(session.root, runner, binary))
                out.blocks.push({ path: line.path, block: line.line, style: 'hash' });
            break;
        }
        case 'lefthook': {
            out.configurations.push(lefthookConfiguration(session.root, runner, binary));
            break;
        }
        // No default
    }
}

function runnerOutputs(session: Session, out: GeneratedProposal): void {
    const runner = session.policyFiles.policy.runner?.tool;
    if (runner === undefined) return;
    const plan = runnerTaskPlan(session.root, runner, session.policyFiles.policy.runner?.tasks);
    out.notes.push(...plan.notes);
    if (runner === 'mise')
        out.files.push(
            miseTasks(everyManifest(session), session.version, session.packageManager !== undefined, plan.tasks),
        );
    if (plan.configuration !== undefined) out.configurations.push(plan.configuration);
}

function workflowOutput(session: Session, out: GeneratedProposal): void {
    const { policy } = session.policyFiles;
    if (policy.ci === undefined) return;
    const swiftScope = session.scopes.find((selection) =>
        selection.selected.some((manifest) => manifest.configuration.name === 'swift'),
    );
    out.files.push(
        (policy.ci.provider === 'github' ? workflowFile : gitlabFile)({
            version: session.version,
            run: policy.ci.run,
            sarif: policy.ci.sarif,
            platforms: policy.ci.platforms,
            swiftScope: swiftScope?.scope.path,
            isMise: policy.runner?.tool === 'mise',
        }),
    );
}

function rootView(session: Session): MergedView {
    const root = session.scopes.find((selection) => selection.scope.path === '') ?? session.scopes[0];
    if (root === undefined) throw new Error('The session has no scope.');
    return root.view;
}

function blockOutputs(session: Session, out: GeneratedProposal): void {
    if (session.repository.hasGit) out.blocks.push({ path: '.gitignore', block: gitignoreBlock(), style: 'hash' });
    out.blocks.push({
        path: '.gitattributes',
        block: '.gspot/** linguist-generated\n.gspot/** text eol=lf',
        style: 'hash',
    });
    if (!session.policyFiles.policy.rules.install) return;
    const block = managedBlock(session);
    for (const path of agentFiles(session.root, session.policyFiles.policy.rules.agents)) {
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
    for (const merge of proposal.merges) mutationTarget(merge.target);
}

/**
 * Renders every generated file, block and merge for the session, in memory.
 * @param session the session
 * @param takeover
 * @returns the files, blocks, merges and package edits
 */
export function emitAll(session: Session, takeover?: ReadonlyMap<string, FileSnapshot>): GeneratedProposal {
    const binary = binaryPath();
    const out: GeneratedProposal = { notes: [], files: [], blocks: [], merges: [], configurations: [] };
    const seen = new Set<string>();
    for (const selection of session.scopes)
        for (const manifest of selection.selected) configurationFiles(session, selection, manifest, out, seen);
    if (out.files.some((file) => file.configuration === 'formatting')) {
        const retained = retainedConfigurationPaths(session, ['prettier', 'ec'], takeover);
        if (retained.length > 0) {
            const adopted = session.policyFiles.policy.tools['editorconfig']?.['adopted'] as
                | EditorconfigAdoption
                | undefined;
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
        const retained = retainedConfigurationPaths(session, ['eslint'], takeover);
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
    out.configurations.push(...bunConfiguration(session));
    hookOutputs(session, out, binary);
    out.files.push(...toolPackages(session), ...toolEnvironment(session));
    runnerOutputs(session, out);
    workflowOutput(session, out);
    out.files.push(...assembleRules(session));
    if (
        session.scopes.some((selection) =>
            selection.selected.some((manifest) => manifest.configuration.name === 'prose'),
        )
    )
        out.files.push(...styleFiles(session.policyFiles.policy, rootView(session)));
    blockOutputs(session, out);
    out.files.sort((a, b) => a.path.localeCompare(b.path));
    combineConfigurations(out);
    validateProposal(out);
    return out;
}
