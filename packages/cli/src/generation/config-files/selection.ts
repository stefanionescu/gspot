import type { Session } from '#cli/types/session.ts';
import type { ConfigFile } from '#cli/types/configurations.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { listCheckTools, listConfiguredChecks } from '#cli/planning/tools.ts';
import { buildMarkdownlintFile } from '#cli/generation/configurations/language/markdown.ts';
import type { UsedNames, OwnedConfigFile, ConfigFileTargets } from '#cli/types/generation/files.ts';

/**
Check whether a Markdown scope inherits the root config because both scopes generate the same text.

@param selected the scoped config file.
@param configFiles the config files and their owners.
@returns whether the root supplies the same text.
*/
export function isRootTextShared(selected: OwnedConfigFile, configFiles: OwnedConfigFile[]): boolean {
    const { configFile, owner } = selected;
    if (configFile.pointer?.inherit !== true || owner.scope.folder.path === '') return false;
    const root = configFiles.find(
        (each) => each.configFile.target === configFile.target && each.owner.scope.folder.path === '',
    );
    if (root === undefined) return false;
    const texts = [selected, root].map((owned) =>
        buildMarkdownlintFile({
            scope: owned.owner.scope,
            level: owned.owner.session.settingsFile.settings.level,
        }),
    );
    return texts[0] === texts[1];
}

/**
Find the repository-relative path of the config file for a scope.

@param scope the folder, empty for the root.
@param configFile the config file from the manifest.
@param configFiles the generated paths by scope and file name, and the scopes whose file failed to build.
@returns the file of the scope, or the root file as a fallback.
@throws the build failure of the file in this scope.
*/
export function getConfigFileTarget(scope: string, configFile: ConfigFile, configFiles: ConfigFileTargets): string {
    const failure = configFiles.failures.get(scope)?.get(configFile.target);
    if (failure !== undefined) throw failure;
    return configFile.per_scope
        ? (configFiles.targets.get(scope)?.get(configFile.target) ?? configFile.target)
        : configFile.target;
}

function isConfigFileWritten(session: Session, file: ConfigFile, used: UsedNames): boolean {
    if (file.level === 'all' && session.settingsFile.settings.level !== 'all') return false;
    const constraints = [
        [file.tool, used.tools],
        [file.check, used.checks],
    ] as const;
    return constraints.every(
        ([names, available]) => !(names.length > 0 && names.every((name) => !available.has(name))),
    );
}

function listScopeConfigFiles(session: Session, scope: Scope, repositoryNames: UsedNames): OwnedConfigFile[] {
    const checks = listConfiguredChecks(session, scope);
    const used = {
        tools: new Set(checks.flatMap((planned) => listCheckTools(planned))),
        checks: new Set(checks.map((planned) => planned.check.id)),
    };
    return scope.configurations.flatMap((configuration) =>
        configuration.configFiles
            .filter((file) => isConfigFileWritten(session, file, file.per_scope ? used : repositoryNames))
            .map((configFile) => ({
                configFile,
                owner: { session, scope, configuration },
            })),
    );
}

/**
List the config files that this run writes, with the scope that owns each.

@param session the repository to build for.
@returns each needed config file and its owner.
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
