// The check graph for a run: stage, scope, file sets, requirements, skips.
// Tool requirements derived from the same applicable check plan used by execution.
import { COVERAGE_FLAGS } from '#cli/config/planning.ts';
import { scopeOf } from '#cli/repository/paths/contracts.ts';
import { everyManifest } from '#cli/configurations/public.ts';
import { ownedBy } from '#cli/repository/selection/public.ts';
import { GspotError, hostPlatform } from '#cli/platform/public.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { filesFor, runsAtRoot, childScopes } from '#cli/planning/files.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/settings.ts';
import type { Manifest, CheckDeclaration } from '#cli/types/configurations.ts';
import { pathMatcher, isOutsideChildren, isToolProjectPath } from '#cli/repository/paths/public.ts';
import { toolPin, toolName, checkToolPin, toolProjectPackage } from '#cli/configurations/contracts.ts';
import { skipFor, selectionStatus, coverageArguments, restrictIgnoredPaths } from '#cli/planning/contracts.ts';

import type {
    Stage,
    Session,
    PlanEntry,
    PlanInputs,
    PlanOptions,
    PlannedCheck,
    LicenseProject,
} from '#cli/types/planning.ts';

function isStageWanted(filter: PlanOptions['stage'], stage: Stage): boolean {
    if (filter === 'any') return true;
    if (filter === 'all') return stage === 'commit' || stage === 'push';
    return filter === stage;
}

function entriesFor(session: Session, scope: ScopeSelection): PlanEntry[] {
    const isRoot = scope.scope.path === '';
    const entries = scope.selected.flatMap((manifest) =>
        manifest.checks
            .map((check) => ({ check, manifest }))
            .filter((entry) => isRoot || !runsAtRoot(manifest, entry.check)),
    );
    if (!isRoot) return entries;
    const own = Object.values(session.policyFiles.policy.check).map((entry) => ({ check: entry }));
    return [...entries, ...own];
}

function isWanted(check: CheckDeclaration, options: PlanOptions): boolean {
    if (options.only !== undefined && !options.only.includes(check.name)) return false;
    if (options.stage === 'any') return true;
    if (check.stage === 'message') return options.stage === 'message';
    return (options.only !== undefined && options.stage === 'all') || isStageWanted(options.stage, check.stage);
}

function planOne(context: PlanInputs, entry: PlanEntry, isRootCheck: boolean): PlannedCheck {
    const { session, scope, options, platform } = context;
    const { check, manifest } = entry;
    // Repository inventory always places the root scope first.
    const rootScope = session.scopes[0] as ScopeSelection;
    const name = toolName(check);
    const tool =
        name === undefined ? undefined : checkToolPin(toolPin(session.manifests.values(), name, manifest), check);
    const planned: PlannedCheck = {
        scope: isRootCheck ? rootScope : scope,
        check,
        ...filesFor(context, entry, isRootCheck),
        ...(manifest === undefined ? {} : { manifest }),
        ...(tool === undefined ? {} : { tool }),
        ...(options.commits === undefined ? {} : { commits: options.commits }),
        ...(options.messageFile === undefined ? {} : { messageFile: options.messageFile }),
    };
    const skip = skipFor(
        planned,
        options,
        { platform, arch: process.arch },
        session.repository.hasGit,
        session.policyFiles.policy,
        context.projects,
    );
    return restrictIgnoredPaths(session, skip === undefined ? planned : { ...planned, skip });
}

function narrowSet(options: PlanOptions): Set<string> | undefined {
    const changed = options.staged ?? options.changed;
    if (options.paths === undefined) return changed === undefined ? undefined : new Set(changed);
    return new Set(options.paths.filter((path) => changed === undefined || changed.includes(path)));
}

// Only an active replacement in this execution plan can own another check's work.
function skipReplacedChecks(planned: PlannedCheck[]): PlannedCheck[] {
    const replacers = new Map(
        planned.flatMap((check): [string, string][] =>
            check.check.replaces === undefined || check.skip !== undefined || !isActive(check)
                ? []
                : [[check.check.replaces, check.check.name]],
        ),
    );
    return planned.map((check) => {
        const replacer = replacers.get(check.check.name);
        if (replacer === undefined || check.skip) return check;
        return { ...check, skip: { cause: 'replaced', note: `${replacer} runs it here` } };
    });
}

function planScope(context: PlanInputs, wholeSeen: Set<string>): PlannedCheck[] {
    const planned: PlannedCheck[] = [];
    const entries = entriesFor(context.session, context.scope).filter(
        ({ check }) => selectionStatus(context.session.policyFiles.policy, context.scope, check)?.cause !== 'level',
    );
    for (const entry of entries) {
        if (!isWanted(entry.check, context.options)) continue;
        const isRootCheck = entry.check.runs === 'once' || entry.check.runs === 'history';
        if (isRootCheck && wholeSeen.has(entry.check.name)) continue;
        if (isRootCheck) wholeSeen.add(entry.check.name);
        planned.push(planOne(context, entry, isRootCheck));
    }
    return planned;
}

function planScopes(session: Session, options: PlanOptions): PlannedCheck[][] {
    const wholeSeen = new Set<string>();
    const platform = hostPlatform();
    const narrow = narrowSet(options);
    return session.scopes.map((scope) => {
        const context: PlanInputs = {
            session,
            scope,
            options,
            platform,
            narrow,
            children: childScopes(session, scope),
            projects: session.packageManifests,
        };
        return planScope(context, wholeSeen);
    });
}

/**
 * Whether a planned check has source input, a deleted trigger, or a commit message to inspect.
 * @param check the planned check
 * @returns whether the check has something to run over
 */
export function isActive(check: PlannedCheck): boolean {
    return (
        check.files.length > 0 ||
        check.triggerPaths.length > 0 ||
        check.check.stage === 'message' ||
        (check.check.runs === 'history' && (check.commits?.length ?? 0) > 0)
    );
}

/**
 * List policy-enabled checks for each applicable scope.
 * @param session the open session
 * @param includeUnsupported whether to include requirements for other platforms
 * @returns every check the policy turns on, in each scope it applies to
 */
export function configuredChecks(session: Session, includeUnsupported = false): PlannedCheck[] {
    return planScopes(session, { stage: 'any', skips: [], includeUnsupported })
        .flatMap((planned) => skipReplacedChecks(planned))
        .filter((check) => isActive(check) && check.skip === undefined);
}

/**
 * Source owners of a planned check, separate from inputs supplied to project-wide analysis.
 * @param session the open session
 * @param check the planned check
 * @returns the files the check's owners select
 */
export function ownedInputs(session: Session, check: PlannedCheck): TrackedFile[] {
    const owners = check.check.files ?? check.manifest?.files;
    const children = check.check.runs === 'scope' ? childScopes(session, check.scope) : [];
    const files = check.files.filter((file) => isOutsideChildren(file.path, children));
    return owners === undefined
        ? []
        : ownedBy(owners, check.scope.selected, files, check.scope.scope.path, check.scope.view.test_files);
}

/**
 * Plans every check for the run.
 * @param session the session
 * @param options stage, paths, only, skips, and the staged or ref-relative file sets
 * @returns the planned checks in scope order
 */
export function planRun(session: Session, options: PlanOptions): PlannedCheck[] {
    const checks = planScopes(session, options).flatMap((planned) => skipReplacedChecks(planned));
    if (options.historyComplete === false) {
        const historyChecks = checks.filter((check) => check.skip === undefined && check.check.runs === 'history');
        if (historyChecks.length > 0)
            throw new GspotError('selection', [
                `Pushed history is incomplete for ${historyChecks.map((check) => check.check.name).join(', ')}. Run git fetch --unshallow and retry.`,
            ]);
    }
    return checks;
}

/**
 * Companion tools consumed by a check's command and its selected native configuration.
 * @param scope the effective configuration selection
 * @param check the declared check
 * @param command the argv actually executed when supplied
 * @returns each explicit and configuration-owned companion once
 */
export function checkCompanions(scope: ScopeSelection, check: CheckDeclaration, command?: string[]): string[] {
    const manifest = scope.selected.find((owner) => owner.checks.includes(check));
    const gated = coverageArguments({ scope, check, ...(manifest === undefined ? {} : { manifest }) }, {});
    const withoutCoverage =
        gated !== check.command && command?.some((part) => COVERAGE_FLAGS.has(part.replace(/=.*/su, ''))) !== true;
    const tools = new Set([check.tool, check.command?.[0], check.fix?.[0], ...(check.other_tools ?? [])]);
    const companions = scope.selected
        .flatMap((manifest) => manifest.toolFiles)
        .filter((config) => config.tool.length === 0 || config.tool.some((name) => tools.has(name)))
        .filter((config) => config.check.length === 0 || config.check.includes(check.name))
        .filter((config) => config.when === undefined || scope.view.configurations.includes(config.when.configuration))
        .flatMap((config) => config.required_tools);
    return [...new Set([...(check.other_tools ?? []), ...companions])].filter((name) => {
        if (!withoutCoverage) return true;
        const pin = toolPin(scope.selected, name);
        return pin.system !== true || pin.kind !== 'library';
    });
}

/**
 * Select each consumer project with its effective license policy and authored scope.
 * @param files the check's actual repository inventory.
 * @param scopes the existing effective selections.
 * @param policy the validated repository policy.
 * @param check the license check declaration.
 * @returns the consumer projects that require installed license reports.
 */
export function licenseProjects(
    files: TrackedFile[],
    scopes: ScopeSelection[],
    policy: Policy,
    check: CheckDeclaration,
): LicenseProject[] {
    return files.flatMap((file) => {
        if (isToolProjectPath(file.path)) return [];
        const scope = scopeOf(
            file.path,
            scopes.map((selection) => selection.scope),
        );
        const selection = scopes.find((entry) => entry.scope.path === scope.path);
        if (selection === undefined) throw new Error(`No selection covers the scope ${scope.path}.`);
        if (
            !selection.selected.some(
                (manifest) =>
                    manifest.configuration.name === 'licenses' &&
                    ownedBy(
                        check.files ?? manifest.files,
                        selection.selected,
                        [file],
                        selection.scope.path,
                        selection.view.test_files,
                    ).length > 0,
            )
        )
            return [];
        const configuration = selection.view.options('licenses');
        return configuration.allowed.length === 0 && Object.keys(configuration.exceptions).length === 0
            ? []
            : [{ manifest: file.path, selection, configuration, skip: selectionStatus(policy, selection, check) }];
    });
}

/**
 * Read executable, fixer, and companion tools consumed by an applicable check.
 * @param check the check with its conditions, scopes, and exclusions resolved
 * @param session the effective scope selections and installation integration.
 * @returns required executable, declared peer, and native installation tools
 */
export function requiredToolNames(check: PlannedCheck, session: Pick<Session, 'scopes' | 'policyFiles'>): string[] {
    const names = new Set(
        [check.tool?.name, ...checkCompanions(check.scope, check.check), check.check.fix?.[0]].filter(
            (name) => name !== undefined,
        ),
    );
    if (typeof check.check.tool === 'object') {
        const paths = licenseProjects(check.files, session.scopes, session.policyFiles.policy, check.check).flatMap(
            ({ skip, manifest }) => (skip === undefined ? [manifest] : []),
        );
        const fileTools = Object.entries(check.check.tool).filter(([pattern]) =>
            paths.some(pathMatcher([`**/${pattern}`])),
        );
        for (const [, name] of fileTools) names.add(name);
    }
    for (const name of names)
        for (const required of new Set(toolProjectPackage(toolPin(check.scope.selected, name))?.requires))
            names.add(required);
    return [...names];
}

/**
 * Select tool declarations consumed by applicable checks, fixers, and their generated configuration.
 * Requirements include supported platforms so committed output does not depend on the current host.
 * @param session the saved policy and repository inventory
 * @returns the selected manifests with only their required tools
 */
export function applicableManifests(session: Session): Manifest[] {
    const checks = configuredChecks(session, true);
    const needed = new Set(checks.flatMap((check) => requiredToolNames(check, session)));
    const selected = everyManifest(session.scopes);
    const owners = new Set(selected);
    for (const name of needed) {
        if (selected.some((manifest) => manifest.tools.some((tool) => tool.name === name))) continue;
        const owner = session.manifests.values().find((manifest) => manifest.tools.some((tool) => tool.name === name));
        if (owner !== undefined) owners.add(owner);
    }
    const manifests: Manifest[] = [];
    for (const manifest of owners) {
        const consumers = checks.filter((check) => check.scope.selected.includes(manifest));
        const ownsEslint =
            consumers.some((check) => check.tool?.name === 'eslint') &&
            manifest.toolFiles.some((config) => config.target.includes('eslint'));
        const ownsPrettier = needed.has('prettier') && manifest.tools.some((tool) => tool.prettier !== undefined);
        manifests.push({
            ...manifest,
            tools: manifest.tools
                .filter(
                    ({ when: conditions }) =>
                        conditions === undefined ||
                        session.scopes.some(({ view }) =>
                            conditions.some((condition) => {
                                if (
                                    condition.level !== undefined &&
                                    condition.level !== session.policyFiles.policy.level
                                )
                                    return false;
                                const value = view.settings[condition.setting];
                                return typeof value === 'object' && value !== null
                                    ? Object.values(value).flat().length > 0
                                    : value !== undefined && value !== false && value !== '';
                            }),
                        ),
                )
                .filter(
                    (tool) =>
                        needed.has(tool.name) ||
                        (ownsEslint &&
                            tool.system !== true &&
                            (tool.kind === 'library' || tool.name === 'eslint-config-prettier')) ||
                        (ownsPrettier && tool.prettier !== undefined),
                )
                .map((tool) => {
                    let pin = tool;
                    for (const check of checks) pin = checkToolPin(pin, check.check);
                    return pin;
                }),
        });
    }
    return manifests;
}
