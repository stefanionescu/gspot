// Every generated output of a repository: configuration files, pointers, blocks, hooks, tool pins, and rules.
import { pathKey } from '#cli/platform/paths.ts';
import type { RuleFile } from '#cli/types/rules.ts';
import { hookFiles } from '#cli/generation/hooks.ts';
import { toolPackages } from '#cli/generation/npm.ts';
import { miseToolsFile } from '#cli/generation/mise.ts';
import { rootView } from '#cli/policy/settings/view.ts';
import { selectRuleFiles } from '#cli/rules/assemble.ts';
import { managedBlock } from '#cli/rules/instructions.ts';
import { parseToolProject } from '#cli/parsers/packages.ts';
import { styleFiles } from '#cli/generation/vale-styles.ts';
import { toolEnvironment } from '#cli/generation/python.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { bunConfiguration } from '#cli/generation/bunfig.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import { templateInputs } from '#cli/generation/templates.ts';
import type { Session } from '#cli/types/execution/session.ts';
import { githubFile, gitlabFile } from '#cli/generation/ci.ts';
import type { Generated } from '#cli/types/generation/output.ts';
import { assertMutationTarget } from '#cli/platform/root/rules.ts';
import { configuredChecks } from '#cli/execution/planning/plan.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { emitConfigurations } from '#cli/generation/configurations.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/settings.ts';
import { PRIVATE_PATHS, GIT_ATTRIBUTES_BLOCK } from '#cli/config/generation/outputs.ts';
import { requiredToolNames, applicableManifests } from '#cli/execution/planning/requirements.ts';
import { UV_LOCK, DOT_GSPOT, TOOL_PYTHON_PROJECT, TOOL_PACKAGE_PROJECT } from '#cli/config/platform/locations.ts';

// CI includes the selected manual checks and adds macOS when a scope selects Swift.
function workflowOutput(policy: Policy, scopes: ScopeSelection[], version: string, generated: Generated): void {
    if (policy.ci === undefined) return;
    const swiftScope = scopes.find((selection) =>
        selection.selected.some((manifest) => manifest.configuration.name === 'swift'),
    );
    generated.files.push(
        (policy.ci.provider === 'github' ? githubFile : gitlabFile)({
            version,
            run: policy.ci.files,
            platforms: policy.ci.platforms,
            swiftScope: swiftScope?.scope.path,
            isMise: policy.run_with === 'mise',
            manualChecks: [
                ...new Set(
                    [
                        ...policy.checks,
                        ...scopes.flatMap((selection) =>
                            selection.selected.flatMap((configuration) => configuration.checks),
                        ),
                    ]
                        .filter((check) => check.stage === 'manual')
                        .map((check) => check.name),
                ),
            ].toSorted((left, right) => left.localeCompare(right)),
        }),
    );
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
    const outside = files.map(({ path }) => path).filter((path) => !path.startsWith(`${DOT_GSPOT}/`));
    const lines = outside
        .toSorted((left, right) => left.localeCompare(right))
        .map((path) => `${attributePattern(path)} text eol=lf`);
    return [GIT_ATTRIBUTES_BLOCK, ...lines].join('\n');
}

function blockOutputs(
    repository: Repository,
    policy: Policy,
    manifests: Manifest[],
    rules: RuleFile[],
    generated: Generated,
): void {
    if (repository.hasGit) generated.blocks.push({ path: '.gitignore', block: gitignoreBlock(), style: 'hash' });
    generated.blocks.push({ path: '.gitattributes', block: attributesBlock(generated.files), style: 'hash' });
    if (!policy.agentRules.enabled) return;
    if (repository.files.some((file) => file.path === 'CLAUDE.md'))
        generated.notes.push('CLAUDE.md text moves to the end of AGENTS.md');
    const block = managedBlock({
        rules: policy.agentRules,
        files: rules,
        level: policy.level,
        hasChecks: manifests.some((manifest) => manifest.checks.length > 0),
    });
    for (const path of new Set(['AGENTS.md', ...policy.agentRules.instruction_files]))
        generated.blocks.push({ path, block, style: 'markdown' });
}

function combineConfigurations(generated: Generated): void {
    const assembled = new Map<string, Generated['configurations'][number]>();
    for (const output of generated.configurations) {
        const previous = assembled.get(output.path);
        if (previous === undefined) assembled.set(output.path, { ...output, changes: [...output.changes] });
        else {
            previous.changes.push(...output.changes);
        }
    }
    generated.configurations = [...assembled.values()];
}

function assertDistinctPaths(generated: Generated): void {
    const paths = new Map<string, string>();
    const outputs = [...generated.files, ...generated.blocks, ...generated.configurations];
    for (const output of outputs) {
        assertMutationTarget(output.path);
        const key = pathKey(output.path);
        const previous = paths.get(key);
        if (previous !== undefined) throw new Error(`Generated destinations collide: ${previous} and ${output.path}`);
        paths.set(key, output.path);
    }
}

/**
 * The managed .gitignore block for private tool projects and generated outputs.
 * @param manifests the manifests whose ignored paths count, every shipped configuration by default
 * @returns the paths that Git must leave untracked
 */
export function gitignoreBlock(
    manifests: Iterable<Pick<Manifest, 'ignored'>> = configurationManifests().values(),
): string {
    return [...new Set([...PRIVATE_PATHS, ...[...manifests].flatMap((manifest) => manifest.ignored)])].join('\n');
}

/**
 * Renders every output in memory and writes nothing.
 * @param session the repository inventory, effective policy, and selected tools
 * @returns the files, managed blocks, authored config-file edits, and notes
 */
export function emitAll(session: Session): Generated {
    const {
        policyFiles: { policy },
        repository,
        scopes,
        version,
    } = session;
    const { root, files } = repository;
    const packageInstaller = session.packageInstaller();
    const manifests = applicableManifests(session);
    const tools = new Set(manifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    const checks = configuredChecks(session, true);
    const repositoryConsumers = { tools, checks: new Set(checks.map((check) => check.spec.name)) };
    const generated: Generated = { notes: [], files: [], blocks: [], configurations: [] };
    const seen = new Set<string>();
    for (const selection of scopes) {
        const inputs = templateInputs(session, selection, manifests);
        const scopeChecks = checks.filter((check) => check.scope.scope.path === selection.scope.path);
        const scopeConsumers = {
            tools: new Set(scopeChecks.flatMap((check) => requiredToolNames(check, policy.run_with))),
            checks: new Set(scopeChecks.map((check) => check.spec.name)),
        };
        emitConfigurations({ root, files, scopes, inputs, selection }, generated, seen, {
            repository: repositoryConsumers,
            scope: scopeConsumers,
        });
    }
    generated.configurations.push(...bunConfiguration(root, scopes));
    generated.files.push(
        ...hookFiles(root, policy, version),
        ...toolPackages(manifests, packageInstaller, policy.run_with),
        ...toolEnvironment(manifests),
    );
    if (policy.run_with === 'mise') generated.files.push(miseToolsFile(manifests, version));
    workflowOutput(policy, scopes, version, generated);
    const selected = everyManifest(scopes);
    const rules = selectRuleFiles(policy.agentRules, selected, repository, policy.level);
    generated.files.push(
        ...rules.map((file) => ({
            path: file.target,
            content: file.content,
            readOnly: true,
            kind: 'rules' as const,
        })),
    );
    if (tools.has('vale')) generated.files.push(...styleFiles(policy, rootView(scopes)));
    blockOutputs(repository, policy, selected, rules, generated);
    generated.files.sort((a, b) => a.path.localeCompare(b.path));
    combineConfigurations(generated);
    assertDistinctPaths(generated);
    return generated;
}

/**
 * Every managed destination, including locks owned by applicable tool projects.
 * @param generated the completed generated outputs
 * @returns the destination paths
 */
export function outputPaths(generated: Generated): Set<string> {
    const paths = new Set(
        [...generated.files, ...generated.blocks, ...generated.configurations].map((output) => output.path),
    );
    for (const file of generated.files) {
        if (file.path === TOOL_PACKAGE_PROJECT) paths.add(parseToolProject(file.content).lockPath);
        if (file.path === TOOL_PYTHON_PROJECT) paths.add(UV_LOCK);
    }
    return paths;
}
