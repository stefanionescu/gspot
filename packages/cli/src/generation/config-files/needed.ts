import type { Session } from '#cli/types/session.ts';
import type { ConfigFile } from '#cli/types/configurations.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { listScopeChecks, listNeededTools } from '#cli/planning/needed-tools.ts';
import type { UsedNames, OwnedConfigFile, ConfigFileGeneration } from '#cli/types/generation/files.ts';

/**
 * Find the repository-relative path of the config file for a scope.
 *
 * @param scope the folder, empty for the root.
 * @param configFile the config file from the manifest.
 * @param targets the generated paths by scope and file name without extension.
 * @returns the file of the scope, or the root file as a fallback.
 */
export function getConfigFileTarget(
    scope: string,
    configFile: ConfigFile,
    targets: ConfigFileGeneration['targets'],
): string {
    return configFile.per_scope ? (targets.get(scope)?.get(configFile.target) ?? configFile.target) : configFile.target;
}

// gspot writes a config file when its level applies and its configuration condition holds. A check must also use one of
// its tools or count among its checks; an empty list asks for nothing.
function isConfigFileNeeded(session: Session, file: ConfigFile, used: UsedNames): boolean {
    if (file.level === 'all' && session.settingsFile.settings.level !== 'all') return false;
    const constraints = [
        [file.tool, used.tools],
        [file.check, used.checks],
    ] as const;
    if (constraints.some(([names, available]) => names.length > 0 && !names.some((name) => available.has(name))))
        return false;
    return true;
}

// Each scope uses its own checks for its own config files and the repository programs for shared config files.
function listScopeConfigFiles(session: Session, scope: Scope, repositoryNames: UsedNames): OwnedConfigFile[] {
    const checks = listScopeChecks(session, scope);
    const used = {
        tools: new Set(checks.flatMap((planned) => listNeededTools(planned))),
        checks: new Set(checks.map((planned) => planned.check.id)),
    };
    return scope.configurations.flatMap((configuration) =>
        configuration.configFiles
            .filter((file) => isConfigFileNeeded(session, file, file.per_scope ? used : repositoryNames))
            .map((configFile) => ({
                configFile,
                owner: { session, scope, configuration },
            })),
    );
}

/**
 * List the config files that this run writes, with the scope that owns each.
 *
 * @param session the repository to build for.
 * @returns each needed config file and its owner.
 */
export function listOwnedConfigFiles(session: Session): OwnedConfigFile[] {
    const repositoryNames = {
        tools: new Set(
            session.neededToolConfigurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)),
        ),
        checks: new Set(session.configuredChecks.map((planned) => planned.check.id)),
    };
    return session.scopes.flatMap((scope) => listScopeConfigFiles(session, scope, repositoryNames));
}
