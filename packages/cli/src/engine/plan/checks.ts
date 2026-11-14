import { GspotError } from '#cli/system/errors.ts';
import type { Check } from '#cli/types/manifests.ts';
import { readHost } from '#cli/system/environment.ts';
import { getRootScope } from '#cli/settings/scopes.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { listNestedScopes } from '#cli/repository/scopes.ts';
import type { Scope, Settings } from '#cli/types/settings.ts';
import type { Session, ScopeCheck } from '#cli/types/tools.ts';
import { isRunElsewhere } from '#cli/engine/plan/test-scopes.ts';
import { findToolName, findCommandTool } from '#cli/manifests/tools.ts';
import { findFirstSkip, findSettingsSkip } from '#cli/engine/plan/skips.ts';
import { isRepositoryRun, isRootOnlyCheck } from '#cli/manifests/checks.ts';
import { selectCheckFiles, buildPlanInventory } from '#cli/engine/plan/files.ts';

import type {
    CheckState,
    PlanOptions,
    PlannedCheck,
    PlannedScope,
    RunSelection,
    ShippedPlannedCheck,
} from '#cli/types/engine/plan.ts';

function listScopeChecks(settings: Settings, scope: Scope, root: Scope): ScopeCheck[] {
    const isRoot = scope.path === '';
    const atRoot = new Set(root.configurations.map(({ name }) => name));
    const configuredChecks = scope.configurations.flatMap((configuration) =>
        configuration.checks
            .map((check) => ({ scope, check, configuration }))
            .filter(
                (configured) =>
                    isRoot || !atRoot.has(configuration.name) || !isRootOnlyCheck(configuration, configured.check),
            ),
    );
    if (!isRoot) return configuredChecks;
    const own = Object.values(settings.commandChecks).map((commandCheck) => ({ scope, check: commandCheck }));
    return [...configuredChecks, ...own];
}

function isWanted(check: Check, options: PlanOptions): boolean {
    if (options.only !== undefined && !options.only.includes(check.id)) return false;
    if (options.stage === 'any') return true;
    if (check.stage === 'message') return options.stage === 'message';
    return options.stage === 'all'
        ? options.only !== undefined || check.stage === 'commit' || check.stage === 'push'
        : options.stage === check.stage;
}

function planCheck(planned: PlannedScope, scopeCheck: ScopeCheck): PlannedCheck {
    const { session, scope } = planned;
    const { check, configuration } = scopeCheck;
    const rootScope = getRootScope(session.scopes);
    const name = findToolName(check);
    const tool =
        name === undefined
            ? undefined
            : findCommandTool([...session.toolConfigurations, ...readConfigurations().values()], name);
    const plannedCheck: PlannedCheck = {
        scope: isRepositoryRun(check) ? rootScope : scope,
        check,
        ...selectCheckFiles(planned, scopeCheck),
        configuration,
        tool,
    };
    const skip = findFirstSkip(plannedCheck, planned);
    return skip === undefined ? plannedCheck : { ...plannedCheck, skip };
}

function buildNarrowedPaths(options: PlanOptions): Set<string> | undefined {
    const changed = options.selection?.paths;
    if (options.paths === undefined) return changed === undefined ? undefined : new Set(changed);
    return new Set(options.paths.filter((path) => changed === undefined || changed.includes(path)));
}

function skipReplacedChecks(planned: PlannedCheck[], selection: RunSelection | undefined): PlannedCheck[] {
    const replacers = new Map(
        planned.flatMap((check): Array<[string, string]> =>
            check.check.instead_of === undefined || check.skip !== undefined || !isActive(check, selection)
                ? []
                : [[check.check.instead_of, check.check.id]],
        ),
    );
    return planned.map((check) => {
        const replacer = replacers.get(check.check.id);
        return replacer === undefined || check.skip
            ? check
            : { ...check, skip: { cause: 'replaced', note: `${replacer} runs it here` } };
    });
}

function listKeptScopeChecks(
    settings: Settings,
    scopes: Scope[],
    isKept: (scope: Scope, check: Check) => boolean,
): ScopeCheck[] {
    const root = getRootScope(scopes);
    const repositoryRuns = new Set<string>();
    return scopes
        .flatMap((scope) => listScopeChecks(settings, scope, root).filter(({ check }) => isKept(scope, check)))
        .filter(({ check }) => {
            if (!isRepositoryRun(check)) return true;
            if (repositoryRuns.has(check.id)) return false;
            repositoryRuns.add(check.id);
            return true;
        });
}

function planScopes(session: Session, options: PlanOptions): PlannedCheck[][] {
    const { settings, scopes } = session;
    const host = readHost();
    const narrowedPaths = buildNarrowedPaths(options);
    const inventory = buildPlanInventory(session.repository.files, narrowedPaths, options.selection);
    const scopePaths = scopes.map(({ path }) => path);
    const enumerated = Map.groupBy(
        listKeptScopeChecks(settings, scopes, (_scope, check) => isWanted(check, options)).filter(
            ({ scope, configuration }) => !isRunElsewhere(session, scope.path, configuration),
        ),
        ({ scope }) => scope.path,
    );
    return scopes.map((scope) => {
        const context: PlannedScope = {
            session,
            scope,
            options,
            host,
            narrowedPaths,
            children: listNestedScopes(scopePaths, scope.path),
            inventory,
        };
        const checks = (enumerated.get(scope.path) ?? []).map((configured) =>
            planCheck(
                {
                    ...context,
                    children: context.children.filter(
                        (child) => !isRunElsewhere(session, child, configured.configuration),
                    ),
                },
                configured,
            ),
        );
        return options.keepLevelOff === true ? checks : checks.filter(({ skip }) => skip?.cause !== 'level');
    });
}

export function isActive(planned: PlannedCheck, selection?: RunSelection): boolean {
    return (
        planned.files.length > 0 ||
        planned.triggerPaths.length > 0 ||
        planned.check.stage === 'message' ||
        (planned.check.runs === 'history' && (selection?.commits?.length ?? 0) > 0)
    );
}

export function buildCheckState(planned: PlannedCheck | undefined): CheckState {
    if (planned === undefined) return { status: 'skipped', cause: 'replaced' };
    if (planned.skip !== undefined) return { status: 'skipped', cause: planned.skip.cause };
    return isActive(planned) ? { status: 'on' } : { status: 'skipped', cause: 'no-files' };
}

/**
Narrow a check that a configuration ships. Only a [[command_check]] has no configuration.
*/
export function assertShippedCheck(planned: PlannedCheck): asserts planned is ShippedPlannedCheck {
    if (planned.configuration === undefined)
        throw new Error(`${planned.check.id} has check code but no configuration.`);
}

/**
Narrow a check that runs a command. The check code of a manifest check without a command is a broken manifest.
*/
export function assertCommandCheck(
    planned: PlannedCheck,
): asserts planned is PlannedCheck & { check: { command: string[] } } {
    if (planned.check.command === undefined) throw new Error(`${planned.check.id} has check code but no command.`);
}

export function planChecks(session: Session, options: PlanOptions): PlannedCheck[] {
    const checks = planScopes(session, options)
        .flatMap((planned) => skipReplacedChecks(planned, options.selection))
        .filter(({ check }) => options.skip?.includes(check.id) !== true);
    if (options.selection?.shallow === true) {
        const historyChecks = checks.filter((check) => check.skip === undefined && check.check.runs === 'history');
        if (historyChecks.length > 0)
            throw new GspotError(
                'git',
                `Pushed history is incomplete for ${historyChecks.map((check) => check.check.id).join(', ')}. Run git fetch --unshallow and retry.`,
            );
    }
    return checks;
}

export function listEnabledChecks(scopes: Scope[], settings: Settings): ScopeCheck[] {
    const root = getRootScope(scopes);
    const configurations = scopes.flatMap((each) => each.configurations);
    return listKeptScopeChecks(
        settings,
        scopes,
        (scope, check) => findSettingsSkip(settings, scope, check) === undefined,
    ).map(({ scope, check, configuration }) => {
        const name = findToolName(check);
        const tool = name === undefined ? undefined : findCommandTool(configurations, name);
        return { scope: isRepositoryRun(check) ? root : scope, check, configuration, tool };
    });
}
