// Every generated output of a repository: configuration files, pointers, blocks, hooks, tool pins, and rules.
import type { Manifest } from '#cli/types/kits.ts';
import { everyManifest } from '#cli/kits/select.ts';
import { hookFiles } from '#cli/generation/hooks.ts';
import { assembleRules } from '#cli/rules/assemble.ts';
import { gitignoreBlock } from '#cli/kits/manifests.ts';
import { managedBlock } from '#cli/rules/instructions.ts';
import { styleFiles } from '#cli/generation/vale-styles.ts';
import { bunConfiguration } from '#cli/generation/bunfig.ts';
import { emitConfigurations } from '#cli/generation/kits.ts';
import { mutationTarget } from '#cli/platform/safe-paths.ts';
import { miseToolsFile } from '#cli/generation/tools/mise.ts';
import { templateInputs } from '#cli/generation/templates.ts';
import { gitlabFile, workflowFile } from '#cli/generation/ci.ts';
import { toolPackages } from '#cli/generation/tools/packages.ts';
import { GSPOT_FOLDER } from '#cli/config/repository/repository.ts';
import type { Repository } from '#cli/types/repository/repository.ts';
import { toolEnvironment } from '#cli/generation/tools/environment.ts';
import { GIT_ATTRIBUTES_BLOCK } from '#cli/config/generation/generation.ts';
import type { Policy, MergedView, ScopeSelection } from '#cli/types/policy/policy.ts';
import type { Generated, GenerationOptions } from '#cli/types/generation/generation.ts';

// Integrations for the selected hook tool. Native gspot hooks need no integration.
function workflowOutput(policy: Policy, scopes: ScopeSelection[], version: string, out: Generated): void {
    if (policy.ci === undefined) return;
    const swiftScope = scopes.find((selection) => selection.selected.some((manifest) => manifest.kit.name === 'swift'));
    out.files.push(
        (policy.ci.provider === 'github' ? workflowFile : gitlabFile)({
            version,
            run: policy.ci.run,
            platforms: policy.ci.platforms,
            swiftScope: swiftScope?.scope.path,
            isMise: policy.runner === 'mise',
        }),
    );
}

function rootView(scopes: ScopeSelection[]): MergedView {
    const root = scopes.find((selection) => selection.scope.path === '') ?? scopes[0];
    if (root === undefined) throw new Error('The session has no scope.');
    return root.view;
}

// A path as a Git attributes pattern that matches only that file: anchored, with glob characters escaped, and quoted
// when it holds a space or a quote.
function attributePattern(path: string): string {
    const escaped = path.replaceAll(/[\\*?[]/gu, (character) => `\\${character}`);
    const pattern = `/${escaped}`;
    if (!/[\s"]/u.test(pattern)) return pattern;
    const quoted = pattern.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`);
    return `"${quoted}"`;
}

// Each whole file gspot writes outside its folder keeps LF too, so a CRLF checkout does not read as an edit.
function attributesBlock(files: Generated['files']): string {
    const outside = files.map(({ path }) => path).filter((path) => !path.startsWith(`${GSPOT_FOLDER}/`));
    const lines = outside
        .toSorted((left, right) => left.localeCompare(right))
        .map((path) => `${attributePattern(path)} text eol=lf`);
    return [GIT_ATTRIBUTES_BLOCK, ...lines].join('\n');
}

function blockOutputs(repository: Repository, policy: Policy, manifests: Manifest[], out: Generated): void {
    if (repository.hasGit) out.blocks.push({ path: '.gitignore', block: gitignoreBlock(), style: 'hash' });
    out.blocks.push({ path: '.gitattributes', block: attributesBlock(out.files), style: 'hash' });
    if (repository.files.some((file) => file.path === 'CLAUDE.md'))
        out.notes.push('CLAUDE.md goes; its own text moves to the end of AGENTS.md');
    if (!policy.rules.install) return;
    const block = managedBlock(policy.rules, manifests, policy.level, repository);
    for (const path of new Set(['AGENTS.md', ...(policy.rules.instructions ?? [])]))
        out.blocks.push({ path, block, style: 'markdown' });
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
        ...hookFiles(root, policy, version),
        ...toolPackages(manifests, packageClient, policy.runner),
        ...toolEnvironment(manifests),
    );
    if (policy.runner === 'mise') out.files.push(miseToolsFile(manifests, version, packageClient !== undefined));
    workflowOutput(policy, scopes, version, out);
    out.files.push(...assembleRules(policy.rules, manifests, policy.level, repository));
    if (scopes.some((selection) => selection.selected.some((manifest) => manifest.kit.name === 'prose')))
        out.files.push(...styleFiles(policy, rootView(scopes)));
    blockOutputs(repository, policy, manifests, out);
    out.files.sort((a, b) => a.path.localeCompare(b.path));
    combineConfigurations(out);
    validatePlan(out);
    return out;
}
