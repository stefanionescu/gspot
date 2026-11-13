import { CONFIG_BOUND_RUNNERS } from '#cli/config/engine.ts';
import { listNestedScopes } from '#cli/repository/scopes.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import type { ShippedPlannedCheck } from '#cli/types/engine/plan.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { Scope } from '#cli/types/settings.ts';
import type { Session } from '#cli/types/tools.ts';

function holdsTestConfig(session: Session, scopePath: string, configuration: Configuration): boolean {
    const isConfig = buildPathMatcher(configuration.files.paths);
    const prefix = scopePath === '' ? '' : `${scopePath}/`;
    return session.repository.files.some(
        ({ path }) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/') && isConfig(path),
    );
}

function runsTestsItself(session: Session, scope: Scope, configuration: Configuration): boolean {
    return (
        scope.configurations.some(({ name }) => name === configuration.name) &&
        holdsTestConfig(session, scope.path, configuration)
    );
}

/**
Vitest and Jest read the config in their working folder and none above it. So a nested scope with no test config
leaves its tests to an enclosing scope that holds one, and a root with no config leaves them to the nested scopes that
hold one.
*/
export function isRunElsewhere(session: Session, scopePath: string, configuration: Configuration | undefined): boolean {
    if (configuration === undefined || !CONFIG_BOUND_RUNNERS.has(configuration.name)) return false;
    if (holdsTestConfig(session, scopePath, configuration)) return false;
    return session.scopes.some(
        (scope) =>
            scope.path !== scopePath &&
            (scopePath === '' || scope.path === '' || scopePath.startsWith(`${scope.path}/`)) &&
            runsTestsItself(session, scope, configuration),
    );
}

export function listOwnTestScopes(session: Session, planned: ShippedPlannedCheck): string[] {
    return listNestedScopes(
        session.scopes
            .filter((scope) => runsTestsItself(session, scope, planned.configuration))
            .map(({ path }) => path),
        planned.scope.path,
    );
}
