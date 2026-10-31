import type { Session } from '#cli/types/session.ts';
import { listCheckTools } from '#cli/planning/tools.ts';
import type { ConfigFile } from '#cli/types/manifests.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import type { UsedNames, OwnedConfigFile, ConfigFileTargets } from '#cli/types/generation/files.ts';

/**
Find the repository-relative path of the config file for a scope.

@param scopePath the folder, empty for the root.
@param configFile the config file from the manifest.
@param configFiles the generated paths by scope and file name, and the scopes whose file failed to build.
@returns the file of the scope, or the root file as a fallback.
@throws the build failure of the file in this scope.
*/
export function getConfigFileTarget(scopePath: string, configFile: ConfigFile, configFiles: ConfigFileTargets): string {
    const failure = configFiles.failures.get(scopePath)?.get(configFile.target);
    if (failure !== undefined) throw failure;
    return configFile.per_scope
        ? (configFiles.targets.get(scopePath)?.get(configFile.target) ?? configFile.target)
        : configFile.target;
}

function isConfigFileWritten(session: Session, file: ConfigFile, usedNames: UsedNames): boolean {
    if (file.level === 'all' && session.settings.level !== 'all') return false;
    const constraints = [
        [file.tool, usedNames.tools],
        [file.check, usedNames.checks],
    ] as const;
    return constraints.every(([names, available]) => names.length === 0 || names.some((name) => available.has(name)));
}

function listScopeConfigFiles(session: Session, scope: Scope, usedNames: UsedNames): OwnedConfigFile[] {
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
        configuration.configFiles
            .filter((file) => isConfigFileWritten(session, file, file.per_scope ? used : usedNames))
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
            .map((configFile) => ({
                configFile,
                owner: { session, scope, configuration },
            })),
    );
}

/**
List the config files that this run writes, with the scope that owns each.

@param session the repository to build for.
*/
export function listOwnedConfigFiles(session: Session): OwnedConfigFile[] {
    const repositoryNames = {
        tools: new Set(
            session.toolConfigurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)),
        ),
        checks: new Set(session.configuredChecks.map((planned) => planned.check.id)),
    };
    return session.scopes.flatMap((scope) => listScopeConfigFiles(session, scope, repositoryNames));
}
