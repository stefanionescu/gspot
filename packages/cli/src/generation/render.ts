// Every generated output of a repository: configuration files, pointers, blocks, hooks, runner tasks, and rules.
import { binaryPath } from '#cli/platform/assets.ts';
import { assembleRules } from '#cli/agents/assemble.ts';
import { bunConfiguration } from '#cli/generation/bun.ts';
import { miseTasks } from '#cli/generation/runner-tasks.ts';
import { styleFiles } from '#cli/generation/vale-styles.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { mutationTarget } from '#cli/platform/safe-paths.ts';
import { applyBlock } from '#cli/lifecycle/managed-blocks.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import { templateInputs } from '#cli/generation/templates.ts';
import { toolPackages } from '#cli/generation/tool-packages.ts';
import { gitignoreBlock } from '#cli/configurations/manifests.ts';
import { runnerTaskPlan } from '#cli/generation/runner-task-plan.ts';
import type { Repository } from '#cli/types/repository/repository.ts';
import { toolEnvironment } from '#cli/generation/tool-environment.ts';
import { agentFiles, managedBlock } from '#cli/agents/instructions.ts';
import { gitlabFile, workflowFile } from '#cli/generation/workflow.ts';
import { preCommitConfiguration } from '#cli/generation/pre-commit.ts';
import { withdrawRetained } from '#cli/generation/retained-outputs.ts';
import { simpleGitHookOutputs } from '#cli/generation/simple-git-hooks.ts';
import { configurationFiles } from '#cli/generation/configuration-files.ts';
import { huskyLines, lefthookConfiguration } from '#cli/generation/hooks.ts';
import type { GeneratedProposal, GenerationOptions } from '#cli/types/generation.ts';
import type { MergedView, Policy, ScopeSelection } from '#cli/types/policy/policy.ts';

// The hook manager integrations gspot writes, by the tool the policy names; gspot's own hooks need none.
const HOOK_OUTPUTS: Record<
    string,
    (root: string, runner: string | undefined, out: GeneratedProposal, binary: string | undefined) => void
> = {
    'pre-commit': (root, runner, out, binary) => out.configurations.push(preCommitConfiguration(root, runner, binary)),
    'simple-git-hooks': (root, runner, out, binary) => {
        simpleGitHookOutputs(root, runner, out, binary);
    },
    husky: (root, runner, out, binary) => {
        for (const line of huskyLines(root, runner, binary))
            out.blocks.push({ path: line.path, block: line.line, style: 'hash' });
    },
    lefthook: (root, runner, out, binary) => out.configurations.push(lefthookConfiguration(root, runner, binary)),
};

function hookOutputs(root: string, policy: Policy, out: GeneratedProposal, binary: string | undefined): void {
    const tool = policy.hooks?.tool;
    if (tool === undefined) return;
    HOOK_OUTPUTS[tool]?.(root, policy.runner?.tool, out, binary);
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

// Whether any scope selects the configuration.
function isSelected(scopes: ScopeSelection[], name: string): boolean {
    return scopes.some((selection) => selection.selected.some((manifest) => manifest.configuration.name === name));
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
 * @param policy the repository policy
 * @param repository the repository with its tracked files
 * @param scopes every resolved scope
 * @param options the version, the package manager, and the takeover originals
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
    withdrawRetained({ root, policy, files, takeover }, out);
    out.configurations.push(...bunConfiguration(root, scopes));
    hookOutputs(root, policy, out, binary);
    out.files.push(...toolPackages(manifests, packageManager, policy.runner?.tool), ...toolEnvironment(manifests));
    runnerOutputs(root, policy, manifests, version, packageManager !== undefined, out);
    workflowOutput(policy, scopes, version, out);
    out.files.push(...assembleRules(policy.rules, manifests));
    if (isSelected(scopes, 'prose')) out.files.push(...styleFiles(policy, rootView(scopes)));
    blockOutputs(root, policy, manifests, hasGit, out);
    out.files.sort((a, b) => a.path.localeCompare(b.path));
    combineConfigurations(out);
    validateProposal(out);
    return out;
}
