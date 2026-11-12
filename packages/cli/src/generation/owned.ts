import { listCheckTools } from '#cli/engine/tools.ts';
import { listToolNames } from '#cli/manifests/read.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { remember } from '#cli/system/cache.ts';
import type { OwnedConfig, UsedNames } from '#cli/types/generation.ts';
import type { Config } from '#cli/types/manifests.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { Scope } from '#cli/types/settings.ts';
import type { ScopeCheck, Session } from '#cli/types/tools.ts';

const OWNED_CONFIGS = Symbol('owned configs');

function isConfigWritten(session: Session, file: Config, usedNames: UsedNames): boolean {
    if (file.level === 'all' && session.settings.level !== 'all') return false;
    const constraints = [
        [file.tool, usedNames.tools],
        [file.check, usedNames.checks],
    ] as const;
    return constraints.every(([names, available]) => names.length === 0 || names.some((name) => available.has(name)));
}

function listScopeConfigs(
    session: Session,
    scope: Scope,
    { usedNames, ownFiles }: { usedNames: UsedNames; ownFiles: TrackedFile[] },
): OwnedConfig[] {
    const checks = selectScopeChecks(session, scope.path);
    const used = {
        tools: new Set(checks.flatMap((planned) => listCheckTools(planned))),
        checks: new Set(checks.map((planned) => planned.check.id)),
    };
    const checkFiles = Map.groupBy(
        checks.flatMap((planned) =>
            listCheckTools(planned).map((tool) => ({
                tool,
                files: planned.check.files ?? planned.configuration?.files,
            })),
        ),
        ({ tool }) => tool,
    );
    return scope.configurations.flatMap((configuration) =>
        configuration.configs
            .filter((file) => isConfigWritten(session, file, file.per_scope ? used : usedNames))
            .filter(
                (file) =>
                    !file.per_scope ||
                    scope.path === '' ||
                    [
                        configuration.files,
                        ...configuration.checks.flatMap((check) => check.files ?? []),
                        ...file.tool.flatMap((tool) => checkFiles.get(tool) ?? []).flatMap(({ files }) => files ?? []),
                    ].some((table) => listCoveredFiles(table, ownFiles, scope).length > 0),
            )
            .map((config) => ({
                config,
                owner: { session, scope, configuration },
            })),
    );
}

/**
List the checks that run for a scope: its own, and the ones that run once for the whole repository.
*/
export function selectScopeChecks(session: Pick<Session, 'configuredChecks'>, scopePath: string): ScopeCheck[] {
    return session.configuredChecks.filter(
        (planned) => planned.scope.path === scopePath || planned.check.runs === 'once',
    );
}

export function listOwnedConfigs(session: Session): OwnedConfig[] {
    return remember(session.cache, OWNED_CONFIGS, session.scopes, () => {
        const usedNames = {
            tools: listToolNames(session.toolConfigurations),
            checks: new Set(session.configuredChecks.map((planned) => planned.check.id)),
        };
        const filesByScope = Map.groupBy(session.repository.files, (file) =>
            selectScopePath(file.path, session.scopes),
        );
        return session.scopes.flatMap((scope) =>
            listScopeConfigs(session, scope, { usedNames, ownFiles: filesByScope.get(scope.path) ?? [] }),
        );
    });
}
