import type { Session } from '#cli/types/session.ts';
import type { ConfigFile } from '#cli/types/configurations.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { listCheckTools, listScopeChecks } from '#cli/planning/tools.ts';
import { buildMarkdownlintFile } from '#cli/generation/configurations/language/markdown.ts';
import type { UsedNames, OwnedConfigFile, ConfigFileGeneration } from '#cli/types/generation/files.ts';

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
            ...owned.owner,
            configFile: owned.configFile,
            targetPath: owned.configFile.target,
            level: owned.owner.session.settingsFile.settings.level,
        }),
    );
    return texts[0] === texts[1];
}

/**
Find the repository-relative path of the config file for a scope.

@param scope the folder, empty for the root.
@param configFile the config file from the manifest.
@param targets the generated paths by scope and file name without extension.
@returns the file of the scope, or the root file as a fallback.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 16 calls in 11 files share it.
export function getConfigFileTarget(
    scope: string,
    configFile: ConfigFile,
    targets: ConfigFileGeneration['targets'],
): string {
    return configFile.per_scope ? (targets.get(scope)?.get(configFile.target) ?? configFile.target) : configFile.target;
}

function isConfigFileWritten(session: Session, file: ConfigFile, used: UsedNames): boolean {
    if (file.level === 'all' && session.settingsFile.settings.level !== 'all') return false;
    const constraints = [
        [file.tool, used.tools],
        [file.check, used.checks],
    ] as const;
    if (constraints.some(([names, available]) => names.length > 0 && !names.some((name) => available.has(name))))
        return false;
    return true;
}

function listScopeConfigFiles(session: Session, scope: Scope, repositoryNames: UsedNames): OwnedConfigFile[] {
    const checks = listScopeChecks(session, scope);
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
