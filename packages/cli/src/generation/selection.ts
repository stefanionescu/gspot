import type { Session } from '#cli/types/session.ts';
import type { Config } from '#cli/types/manifests.ts';
import { listCheckTools } from '#cli/planning/tools.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import type { UsedNames, OwnedConfig, ConfigTargets } from '#cli/types/generation/files.ts';

/**
Find the repository-relative path of the config file for a scope.

@param scopePath the folder, empty for the root.
@param config the config file from the manifest.
@param configs the generated paths by scope and file name, and the scopes whose file failed to build.
@returns the file of the scope, or the root file as a fallback.
@throws the build failure of the file in this scope.
*/
export function getConfigTarget(scopePath: string, config: Config, configs: ConfigTargets): string {
    const failure = configs.failures.get(scopePath)?.get(config.target);
    if (failure !== undefined) throw failure;
    return config.per_scope ? (configs.targets.get(scopePath)?.get(config.target) ?? config.target) : config.target;
}

function isConfigWritten(session: Session, file: Config, usedNames: UsedNames): boolean {
    if (file.level === 'all' && session.settings.level !== 'all') return false;
    const constraints = [
        [file.tool, usedNames.tools],
        [file.check, usedNames.checks],
    ] as const;
    return constraints.every(([names, available]) => names.length === 0 || names.some((name) => available.has(name)));
}

function listScopeConfigs(session: Session, scope: Scope, usedNames: UsedNames): OwnedConfig[] {
    const ownFiles = session.repository.files.filter(
        (file) => selectScopePath(file.path, session.scopes) === scope.path,
    );
    const checks = session.configuredChecks.filter(
        (planned) => planned.scope.path === scope.path || planned.check.runs === 'once',
    );
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
                    ].some(
                        (table) =>
                            listCoveredFiles(table, ownFiles, {
                                configurations: scope.configurations,
                                scopePath: scope.path,
                                settings: scope.settings,
                            }).length > 0,
                    ),
            )
            .map((config) => ({
                config,
                owner: { session, scope, configuration },
            })),
    );
}

/**
List the config files that this run writes, with the scope that owns each.

@param session the repository to build for.
*/
export function listOwnedConfigs(session: Session): OwnedConfig[] {
    const repositoryNames = {
        tools: new Set(
            session.toolConfigurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)),
        ),
        checks: new Set(session.configuredChecks.map((planned) => planned.check.id)),
    };
    return session.scopes.flatMap((scope) => listScopeConfigs(session, scope, repositoryNames));
}
