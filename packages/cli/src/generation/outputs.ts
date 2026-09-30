// Every generated output of a repository: configuration files, pointers, blocks, hooks, tool pins, and rules.
import type { Manifest } from '#cli/types/kits.ts';
import { everyManifest } from '#cli/kits/select.ts';
import { hookFiles } from '#cli/generation/hooks.ts';
import { assembleRules } from '#cli/agents/assemble.ts';
import { gitignoreBlock } from '#cli/kits/manifests.ts';
import { bunConfiguration } from '#cli/generation/bun.ts';
import { styleFiles } from '#cli/generation/vale-styles.ts';
import { emitConfigurations } from '#cli/generation/kits.ts';
import { mutationTarget } from '#cli/platform/safe-paths.ts';
import { applyBlock } from '#cli/lifecycle/managed-blocks.ts';
import { miseToolsFile } from '#cli/generation/tools/mise.ts';
import { templateInputs } from '#cli/generation/templates.ts';
import { GIT_ATTRIBUTES_BLOCK } from '#cli/config/generation.ts';
import { toolPackages } from '#cli/generation/tools/packages.ts';
import type { Repository } from '#cli/types/repository/repository.ts';
import { agentFiles, managedBlock } from '#cli/agents/instructions.ts';
import { gitlabFile, workflowFile } from '#cli/generation/workflow.ts';
import { toolEnvironment } from '#cli/generation/tools/environment.ts';
import type { Generated, GenerationOptions } from '#cli/types/generation.ts';
import type { Policy, MergedView, ScopeSelection } from '#cli/types/policy/policy.ts';

// Integrations for the selected hook tool. Native gspot hooks need no integration.
function workflowOutput(policy: Policy, scopes: ScopeSelection[], version: string, out: Generated): void {
    if (policy.ci === undefined) return;
    const swiftScope = scopes.find((selection) => selection.selected.some((manifest) => manifest.kit.name === 'swift'));
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

function blockOutputs(repository: Repository, policy: Policy, manifests: Manifest[], out: Generated): void {
    const { root, hasGit } = repository;
    if (hasGit) out.blocks.push({ path: '.gitignore', block: gitignoreBlock(), style: 'hash' });
    out.blocks.push({ path: '.gitattributes', block: GIT_ATTRIBUTES_BLOCK, style: 'hash' });
    if (!policy.guides.install) return;
    const block = managedBlock(policy.guides, manifests, policy.level, repository);
    for (const path of agentFiles(root, policy.guides.agents)) {
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

function combineConfigurations(plan: Generated): void {
    const assembled = new Map<string, Generated['configurations'][number]>();
    for (const output of plan.configurations) {
        const previous = assembled.get(output.path);
        if (previous === undefined) assembled.set(output.path, { ...output, changes: [...output.changes] });
        else {
            if (previous.format !== output.format)
                throw new Error(`Generated configuration formats conflict: ${output.path}`);
            previous.changes.push(...output.changes);
        }
    }
    plan.configurations = [...assembled.values()];
}

function validatePlan(plan: Generated): void {
    const paths = new Map<string, string>();
    const outputs = [...plan.files, ...plan.blocks, ...plan.merges, ...plan.configurations];
    for (const output of outputs) {
        mutationTarget(output.path);
        const key = output.path.normalize('NFC').toLowerCase();
        const previous = paths.get(key);
        if (previous !== undefined) throw new Error(`Generated destinations collide: ${previous} and ${output.path}`);
        paths.set(key, output.path);
    }
}

/**
 * Renders proposed files in memory while retaining reads at the caller's lifecycle lock boundary.
 * @param policy the repository policy
 * @param repository the repository with its tracked files
 * @param scopes every resolved scope
 * @param options the version and the package manager
 * @returns the files, blocks, merges, and package edits
 */
export function emitAll(
    policy: Policy,
    repository: Repository,
    scopes: ScopeSelection[],
    options: GenerationOptions,
): Generated {
    const { root, files } = repository;
    const { version, packageClient } = options;
    const manifests = everyManifest(scopes);
    const out: Generated = { notes: [], files: [], blocks: [], merges: [], configurations: [] };
    const seen = new Set<string>();
    for (const selection of scopes) {
        const inputs = templateInputs(root, policy, files, scopes, selection, version);
        for (const manifest of selection.selected)
            emitConfigurations({ root, files, scopes, inputs, selection, manifest }, out, seen);
    }
    out.configurations.push(...bunConfiguration(root, scopes));
    out.files.push(
        ...hookFiles(root, policy),
        ...toolPackages(manifests, packageClient, policy.runner?.tool),
        ...toolEnvironment(manifests),
    );
    if (policy.runner?.tool === 'mise') out.files.push(miseToolsFile(manifests, version, packageClient !== undefined));
    workflowOutput(policy, scopes, version, out);
    out.files.push(...assembleRules(policy.guides, manifests, policy.level, repository));
    if (scopes.some((selection) => selection.selected.some((manifest) => manifest.kit.name === 'prose')))
        out.files.push(...styleFiles(policy, rootView(scopes)));
    blockOutputs(repository, policy, manifests, out);
    out.files.sort((a, b) => a.path.localeCompare(b.path));
    combineConfigurations(out);
    validatePlan(out);
    return out;
}
