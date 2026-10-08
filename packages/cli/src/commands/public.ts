// Open the command session and format its shared help metadata.
import { join, posix, resolve } from 'node:path';
import { readPolicy } from '#cli/policy/public.ts';
import { emitAll } from '#cli/generation/public.ts';
import { GspotError } from '#cli/platform/public.ts';
import type { Session } from '#cli/types/planning.ts';
import { printResult } from '#cli/terminal/public.ts';
import { installUv } from '#cli/tools/python/public.ts';
import { npmPins } from '#cli/configurations/contracts.ts';
import { readRepository } from '#cli/repository/public.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import type { Policy } from '#cli/types/policy/settings.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { scopeOf } from '#cli/repository/paths/contracts.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { applicableManifests } from '#cli/planning/public.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { createReadCache } from '#cli/platform/root/public.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { writePolicyFile } from '#cli/policy/document/public.ts';
import { RUNNING_VERSION } from '#cli/config/platform/runtime.ts';
import { findRoot } from '#cli/repository/discovery/contracts.ts';
import { preparePolicy } from '#cli/policy/document/contracts.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import type { ScopeSelections } from '#cli/types/commands/session.ts';
import { XCODE_PROJECT_FILE } from '#cli/config/checks/tool/xcode.ts';
import type { Drift, ApplyReport } from '#cli/types/lifecycle/apply.ts';
import { FILE_PREFIX_BYTES } from '#cli/config/repository/inventory.ts';
import { planReplacement } from '#cli/lifecycle/ownership/contracts.ts';
import { selectForScope } from '#cli/configurations/selection/public.ts';
import { scopeView, knownSettings } from '#cli/policy/settings/public.ts';
import { pathMatcher, filenameMatcher } from '#cli/repository/paths/public.ts';
import type { ApplyOptions, ApplyPlanJson } from '#cli/types/commands/apply.ts';
import { reconcileConfigurations } from '#cli/lifecycle/selection/contracts.ts';
import { detectConfigurations } from '#cli/configurations/selection/contracts.ts';
import { fileDeclarations, configurationManifests } from '#cli/configurations/public.ts';
import { selectPackageInstaller, inspectPackageInstaller } from '#cli/tools/npm/public.ts';
import { applyPlan, getOwnership, openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { computeDrift, readVersionPin, writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import type { PackageInstaller, PackageInstallerIdentity } from '#cli/types/parsers/packages.ts';

// Resolves every scope: its selected configurations, settings surface, and merged view.
async function scopeSelections(
    policy: Policy,
    repository: Repository,
    manifests: Map<string, Manifest>,
): Promise<ScopeSelections> {
    const { files, scopes } = repository;
    const general = new Map([...manifests].filter(([, manifest]) => manifest.configuration.kind === 'general'));
    const automatic = detectConfigurations(repository.root, files, general, []).flatMap(({ configuration }) =>
        manifests.get(configuration)?.configuration.when?.git !== true || repository.hasGit ? [configuration] : [],
    );
    const effective = { ...policy, configurations: [...new Set([...policy.configurations, ...automatic])] };
    let identity: Promise<PackageInstallerIdentity> | undefined;
    const selectInstaller = () =>
        (identity ??= selectPackageInstaller(
            repository.root,
            repository.files.filter((file) => file.kind === 'source').map((file) => file.path),
        ));
    const selections = await Promise.all(
        scopes.map(async (scope) => {
            const selected = selectForScope(effective, scope.path, manifests);
            const surface = knownSettings(selected, policy.level);
            const declared = surface.defaults.get('swift.xcode_project');
            if (declared !== undefined) {
                const project = files.find(
                    (file) => file.path.endsWith(XCODE_PROJECT_FILE) && scopeOf(file.path, scopes).path === scope.path,
                );
                surface.defaults.set('swift.xcode_project', {
                    ...declared,
                    value: project === undefined ? '' : posix.relative(scope.path, posix.dirname(project.path)),
                });
            }
            const openapi = selected.find((manifest) => manifest.configuration.name === 'openapi');
            const document = surface.defaults.get('openapi.document');
            if (openapi !== undefined && document !== undefined) {
                const matches = filenameMatcher(openapi.detect.filenames);
                const detected = files.find(
                    (file) =>
                        file.kind === 'source' && matches(file.path) && scopeOf(file.path, scopes).path === scope.path,
                );
                surface.defaults.set('openapi.document', {
                    ...document,
                    value: detected === undefined ? '' : posix.relative(scope.path, detected.path),
                });
            }
            const build = surface.defaults.get('site.build_command');
            if (build !== undefined) {
                const { name } = await selectInstaller();
                surface.defaults.set('site.build_command', { ...build, value: [name, 'run', 'build'] });
            }
            const view = scopeView(surface, effective, selected, scope.path);
            return { scope, selected, surface, view };
        }),
    );
    return { scopes: selections, selectInstaller };
}

function driftText(drift: Drift[]): string {
    const noun = drift.length === 1 ? 'file' : 'files';
    const lines = [`${String(drift.length)} generated ${noun} need updating:`, ''];
    for (const entry of drift) {
        const rules = (entry.rules ?? []).flatMap((rule) => {
            const at = rule.path === '' ? 'root' : rule.path;
            return (['added', 'removed', 'changed'] as const)
                .filter((change) => rule[change].length > 0)
                .map((change) => `    ${at}: ${change} ${rule[change].join(', ')}`);
        });
        const differences = (entry.diff ?? '').split('\n').map((line) => `    ${line}`);
        lines.push(`  ${entry.path}  ${entry.kind}`, ...rules);
        if ((entry.diff ?? '') !== '') lines.push(...differences);
    }
    lines.push(
        '',
        'Run gspot apply to write these files. apply keeps a generated file you edited; move it aside to get the new version.',
    );
    return `${lines.join('\n')}\n`;
}

function planApply(session: Session, policy: string, configurations: string[]): CommandResult {
    const generated = emitAll(session);
    const drift = computeDrift(session.root, session.policyFiles.policy, generated);
    const summary = drift.length === 0 ? 'every generated file is up to date\n' : driftText(drift);
    const text = summary + generated.notes.map((note) => `note     ${note}\n`).join('');
    const pin = { from: readVersionPin(session.root), to: session.version };
    const json: ApplyPlanJson = { dryRun: true, policy, configurations, pin, drift, notes: generated.notes };
    const version = pin.from === pin.to ? '' : `version ${pin.from ?? 'unpinned'} -> ${pin.to}\n`;
    return { text: `${version}${text}`, json, exitCode: 0 };
}

function reportText(report: ApplyReport): string {
    const lines = [
        ...report.written.map((path) => `wrote    ${path}`),
        ...report.updated.map((path) => `updated  ${path}`),
        ...report.removed.map((path) => `removed  ${path}`),
        ...report.notes.map((note) => `note     ${note}`),
    ];
    if (lines.length === 0) lines.push(`everything up to date (${String(report.unchanged.length)} files)`);
    return `${lines.join('\n')}\n`;
}

/**
 * Opens a repository session. Throws GspotError (policy or selection) when gspot.toml or configuration selection is invalid.
 * @param rootPath the repository root
 * @param policyFiles the policy as read, read here by default
 * @returns the session
 */
export async function openSession(rootPath: string, policyFiles = readPolicy(rootPath)): Promise<ToolSession> {
    const reads = createReadCache(rootPath);
    const root = reads.root;
    const manifests = configurationManifests();
    const policy = { ...policyFiles.policy };
    const selected = new Map(
        ['', ...Object.keys(policy.scope)].map((path) => [path, selectForScope(policy, path, manifests)]),
    );
    policy.declarations = fileDeclarations(policy.declarations, selected);
    const repository = await readRepository(
        root,
        policy.declarations,
        Object.entries(policy.scope).map(([path, scope]) => ({ path, configurations: scope.configurations })),
        policy.exclude,
        reads,
    );
    // Init plans native configuration before the policy becomes a tracked file.
    if (!repository.files.some((file) => file.path === POLICY_FILE) && !pathMatcher(policy.exclude)(POLICY_FILE)) {
        const bytes = Buffer.from(policyFiles.text);
        repository.files.push({
            path: POLICY_FILE,
            prefix: bytes.subarray(0, FILE_PREFIX_BYTES),
            kind: 'source',
            kindSource: 'policy',
            tags: [],
            executable: false,
            size: bytes.length,
        });
    }
    const { scopes, selectInstaller } = await scopeSelections(policy, repository, manifests);
    let resolved: PackageInstaller | undefined;
    let resolvedPython: Promise<string> | undefined;
    const session: ToolSession = {
        pythonInstaller: (cancelSignal) => {
            resolvedPython ??= installUv(root, policy.runner, cancelSignal);
            return resolvedPython;
        },
        packageInstaller() {
            if (installer === undefined) return undefined;
            resolved ??= inspectPackageInstaller(root, installer);
            return resolved;
        },
        root,
        version: RUNNING_VERSION,
        policyFiles: { ...policyFiles, policy },
        manifests,
        repository,
        scopes,
        inspections: new Map(),
        getPendingInstallations: (path) => getOwnership(path).installing,
        reads,
    };
    const installer: PackageInstallerIdentity | undefined =
        Object.keys(npmPins(applicableManifests(session), policy.runner)).length > 0
            ? await selectInstaller()
            : undefined;
    return session;
}

/**
 * Format the command's shared documentation for Commander.
 * @param name the registered command name
 * @returns levels, exit descriptions, and examples
 */
export function commandHelp(name: string): string {
    const help = COMMAND_HELP[name];
    if (help === undefined) throw new Error(`Command ${name} has no help metadata.`);
    return [
        ...(help.levels === undefined ? [] : ['\nLevels:\n' + help.levels]),
        '\nExit codes:\n' + help.exitCodes,
        '\nExample:\n' + help.examples,
    ].join('\n');
}

/**
 * Registers apply.
 * @param program the commander program
 */
export function registerApply(program: Program): void {
    program
        .command('apply')
        .summary('Write the generated files from gspot.toml')
        .description(
            'Reconcile configurations with the repository, then write the tool files, agent rules, Git hooks, and CI workflow from gspot.toml. A generated file you edited stays as it is, and apply names it. --dry-run shows every change, including each rule that changes, without writing project files. apply installs no tools: run gspot install after it.',
        )
        .addHelpText('after', commandHelp('apply'))
        .option('--dry-run', 'Show the changes without writing project files')
        .action(async (flags, command) => {
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());
            printResult(
                await applyCommand({
                    cwd,
                    isDryRun: flags.dryRun === true,
                }),
            );
        });
}

/**
 * Generates configuration or previews proposed changes without writing.
 * @param options the parsed flags
 * @returns the command result
 */
export async function applyCommand(options: ApplyOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    using log = options.isDryRun ? undefined : openOwnership(root);
    const current = await openSession(root);
    const reconciliation = reconcileConfigurations(current);
    const proposal = preparePolicy(root, reconciliation.mutate);
    if (!proposal.original.bytes.equals(Buffer.from(current.policyFiles.text)))
        throw new GspotError('policy', ['The gspot.toml file changed while gspot was running. Run the command again.']);
    const session = await openSession(root, {
        policy: proposal.policy,
        text: proposal.text,
        path: join(root, POLICY_FILE),
        errors: [],
    });
    if (log === undefined) {
        const result = planApply(session, proposal.text, reconciliation.notes);
        return {
            ...result,
            text: `${reconciliation.notes.map((note) => 'note     ' + note + '\n').join('')}${result.text}`,
        };
    }
    const generated = emitAll(session);
    writePolicyFile({
        files: log.files,
        text: proposal.text,
        original: proposal.original,
        publish: (next, expected) => {
            applyPlan(log, {
                ...planReplacement(log, { path: POLICY_FILE, next, kind: 'policy', canReplace: true, expected }),
                before: expected,
            });
        },
    });
    const report = writeGeneratedFiles(session, log, undefined, generated);
    report.notes.unshift(...reconciliation.notes);
    return { text: reportText(report), json: report, exitCode: 0 };
}
