import { statSync } from 'node:fs';
import { sep, join } from 'node:path';
import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import type { Config } from '#cli/types/repository.ts';
import { extractConfigName } from '#cli/engine/files.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { ScopeSettings } from '#cli/types/settings.ts';
import type { CheckSession } from '#cli/types/engine/run.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { listGeneratedPaths } from '#cli/repository/files/classify.ts';
import { addPluginExtensions } from '#cli/repository/files/selection.ts';
import { listWorkspaceFolders } from '#cli/repository/javascript/workspaces.ts';
import type { CommandLine, ConfigTargets, Substitutions, CommandArgument } from '#cli/types/engine/tool-runs.ts';

import {
    FILE_PLACEHOLDER,
    EACH_PLACEHOLDER,
    FORMATTER_CHECKS,
    FILES_PLACEHOLDER,
    CONFIG_PLACEHOLDER,
    COMMAND_PLACEHOLDER,
    POINTER_PLACEHOLDER,
    WORKSPACE_PLACEHOLDER,
    SETTING_ONLY_PLACEHOLDER,
} from '#cli/config/engine.ts';

function assertArgumentList(value: unknown, name: string): string[] {
    if (Array.isArray(value) && value.every((element) => typeof element === 'string')) return value;
    throw new GspotError('settings', `Command setting ${name} must contain only string arguments.`);
}

function expandEachPlaceholder(planned: PlannedCheck, argument: string): string[] | undefined {
    const groups = EACH_PLACEHOLDER.exec(argument)?.groups;
    if (groups === undefined) return undefined;
    const name = groups['setting'] as string;
    return assertArgumentList(planned.scope.settings.valuesByKey[name] ?? [], name).flatMap((value) => [
        groups['flag'] as string,
        value.split('/').join(sep),
    ]);
}

function listConfigs(planned: PlannedCheck): Config[] {
    const own = planned.scope.configurations
        .filter((configuration) => configuration.checks.some((check) => check.id === planned.check.id))
        .flatMap((configuration) => configuration.configs);
    const every = readConfigurations()
        .values()
        .flatMap((configuration) => configuration.configs)
        .toArray();
    return [...own, ...every];
}

function selectPointerPath(session: CheckSession, scopePath: string, name: string): string {
    const path = joinScope(scopePath, name);
    const generated = listGeneratedPaths(session.repository.files);
    return !generated.has(path) && generated.has(name) ? name : path;
}

function expandArgument(
    session: CheckSession,
    planned: PlannedCheck,
    argument: string,
    substitutions: Substitutions,
): CommandArgument[] {
    const files = FILES_PLACEHOLDER.exec(argument);
    if (files !== null) return substitutions.files.map((file) => `${files.groups?.['prefix'] ?? ''}${file}`);
    if (argument === FILE_PLACEHOLDER) return [{ file: true }];
    const workspace = WORKSPACE_PLACEHOLDER.exec(argument)?.[1];
    if (workspace !== undefined)
        return substitutions.scope !== '' && listWorkspaceFolders(substitutions.root).includes(substitutions.scope)
            ? [workspace, substitutions.scope]
            : [];
    return [replacePlaceholders(session, planned, argument, substitutions)];
}

function buildFormattedExtensions({ scope: { configurations } }: PlannedCheck): string {
    const extensions = configurations.flatMap((configuration) =>
        configuration.checks
            .filter(({ id }) => FORMATTER_CHECKS.has(id))
            .flatMap((check) => addPluginExtensions(check.files ?? configuration.files, configurations).extensions),
    );
    return String.raw`\.(${[...new Set(extensions)].map((extension) => extension.slice(1)).join('|')})$`;
}

function buildPlaceholderReaders(
    session: CheckSession,
    planned: PlannedCheck,
    substitutions: Substitutions,
): Record<string, (value: string) => string> {
    return {
        setting: (name) => getScalarSetting(planned.scope.settings, name),
        config_file: (name) =>
            join(substitutions.root, getConfigPath(session, planned, name))
                .split('/')
                .join(sep),
        pointer: (name) => selectPointerPath(session, substitutions.scope, name).split('/').join(sep),
        formatted_extensions: () => buildFormattedExtensions(planned),
        scope: () => (substitutions.scope === '' ? '.' : substitutions.scope),
        root: () => substitutions.root,
        message_file: () => substitutions.messageFile ?? '',
    };
}

/**
Find the repository-relative path of the config file for a scope.

@param scopePath the folder, empty for the root.
@param config the config file from the manifest.
@param configs the generated paths by scope and file name, and the scopes whose file failed to build.
@returns the file of the scope, or the root file when the scope has no file of its own.
@throws the build failure of the file in this scope.
*/
export function getConfigTarget(scopePath: string, config: Config, configs: ConfigTargets): string {
    const failure = configs.failures.get(scopePath)?.get(config.target);
    if (failure !== undefined) throw failure;
    return config.per_scope ? (configs.targets.get(scopePath)?.get(config.target) ?? config.target) : config.target;
}

/**
Check whether a check that names {workspace:<flag>} runs in its scope folder. That happens when the scope holds its own
package.json and no workspace declares it. The tool then runs in that package as in a repository of its own, and
reports its paths from there.

@param root the repository, or the copy of it that the tool runs in.
@param planned the check and its scope.
*/
export function isPackageFolderRun(root: string, planned: PlannedCheck): boolean {
    const scopePath = planned.scope.path;
    if (scopePath === '' || (planned.check.command ?? []).every((argument) => !WORKSPACE_PLACEHOLDER.test(argument)))
        return false;
    return (
        statSync(join(root, scopePath, PACKAGE_JSON), { throwIfNoEntry: false }) !== undefined &&
        !listWorkspaceFolders(root).includes(scopePath)
    );
}

/**
Find the path of the config file that {config_file:<name>} names, with the configurations of the check first.

@param session the repository and its configurations.
@param planned the check that names it.
@param name the config file path without its extensions.
@returns the repository-relative path in the scope of the check.
@throws the build failure of that config file in the scope.
*/
export function getConfigPath(session: CheckSession, planned: PlannedCheck, name: string): string {
    const config = listConfigs(planned).find(({ file }) => extractConfigName(file) === name);
    if (!config)
        throw new GspotError(
            'settings',
            `Check ${planned.check.id} names {config_file:${name}} and no configuration writes it.`,
        );
    return getConfigTarget(planned.scope.path, config, session.generation.buildConfigs(session));
}

/**
Lists the config files that a check command or its environment names.

@param session the repository and its configurations.
@param planned the check that runs.
@param command the arguments to scan.
@returns the config file paths, relative to the root.
*/
export function listCommandConfigs(session: CheckSession, planned: PlannedCheck, command: readonly string[]): string[] {
    const words = [...command, ...(planned.check.env === undefined ? [] : Object.values(planned.check.env))];
    const scope = planned.scope.path;
    return [
        ...new Set(
            words.flatMap((segment) => {
                const configured = segment
                    .matchAll(CONFIG_PLACEHOLDER)
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) => getConfigPath(session, planned, name))
                    .toArray();
                const pointed = segment
                    .matchAll(POINTER_PLACEHOLDER)
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) => selectPointerPath(session, scope, name))
                    .toArray();
                return [...configured, ...pointed];
            }),
        ),
    ].toSorted((left, right) => compareText(left, right));
}

/**
Lists the source and config files that a copy needs for a command.

@param session the repository and its configurations.
@param planned the check and its files.
@param command the arguments, with config file placeholders.
@returns repository-relative paths for the copy.
*/
export function listCopyFiles(session: CheckSession, planned: PlannedCheck, command: string[]): string[] {
    const scope = planned.scope.path;
    const owned = (planned.configuration?.configs ?? []).map((config) =>
        getConfigTarget(scope, config, session.generation.buildConfigs(session)),
    );
    return [
        ...new Set([
            ...planned.files.map(({ path }) => path),
            ...listCommandConfigs(session, planned, command),
            ...owned,
        ]),
    ];
}

/**
Get the text of a scalar setting for a placeholder.

@param scopeSettings the values of the scope.
@param name the dotted key.
*/
export function getScalarSetting(scopeSettings: ScopeSettings, name: string): string {
    const found = scopeSettings.valuesByKey[name];
    if (Array.isArray(found))
        throw new GspotError('settings', `List setting ${name} must occupy a whole command argument.`);
    return typeof found === 'string' || typeof found === 'number' || typeof found === 'boolean' ? String(found) : '';
}

/**
Expands a scalar command argument or environment value from the check scope. One pass reads the whole text, so a value
that a setting supplies stays literal.

@param session the repository and settings.
@param planned the check and its scope.
@param argument the value with placeholders.
@param substitutions the expansion values.
*/
export function replacePlaceholders(
    session: CheckSession,
    planned: PlannedCheck,
    argument: string,
    substitutions: Substitutions,
): string {
    const readers = buildPlaceholderReaders(session, planned, substitutions);
    return argument.replaceAll(
        COMMAND_PLACEHOLDER,
        (placeholder, name: string, value: string = '') => readers[name]?.(value) ?? placeholder,
    );
}

/**
Expands setting and scope placeholders, and keeps a marker for each file slot.

@param session the repository and settings.
@param planned the check and its scope.
@param command the arguments as declared.
@param substitutions the expansion values.
*/
export function expandCommand(
    session: CheckSession,
    planned: PlannedCheck,
    command: string[],
    substitutions: Substitutions,
): CommandArgument[] {
    return command.flatMap((argument) => {
        const name = SETTING_ONLY_PLACEHOLDER.exec(argument)?.groups?.['name'];
        if (name !== undefined) {
            const value = planned.scope.settings.valuesByKey[name];
            if (Array.isArray(value)) return assertArgumentList(value, name);
        }

        const replaced = expandEachPlaceholder(planned, argument);
        return replaced ?? expandArgument(session, planned, argument, substitutions);
    });
}

/**
Replaces every file marker after variable-length arguments have expanded.

@param command the expanded command.
@param files the paths relative to the working folder.
@returns one command per file, or one command when no file marker exists.
*/
export function buildFileCommandLines(command: CommandArgument[], files: string[]): CommandLine[] {
    const hasFile = command.some((segment) => typeof segment !== 'string');
    return (hasFile ? files : ['']).map((file) => ({
        commandArguments: command.map((argument) => (typeof argument === 'string' ? argument : file)),
        ...(hasFile && { file }),
    }));
}
