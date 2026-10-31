import { statSync } from 'node:fs';
import { sep, join } from 'node:path';
import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { type Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import type { ConfigFile } from '#cli/types/manifests.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { buildConfigFiles } from '#cli/generation/configs.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { extractConfigFileName } from '#cli/manifests/tools.ts';
import { getConfigFileTarget } from '#cli/generation/selection.ts';
import { listGeneratedPaths } from '#cli/repository/files/classify.ts';
import type { ScopeSettings } from '#cli/types/settings/inheritance.ts';
import { listWorkspaceFolders } from '#cli/repository/javascript/workspaces.ts';
import { FILE_PLACEHOLDER, SETTING_PLACEHOLDER } from '#cli/config/placeholders.ts';
import type { CommandLine, Substitutions, CommandArgument } from '#cli/types/runs/command.ts';

import {
    ROOT_PLACEHOLDER,
    EACH_PLACEHOLDER,
    FILES_PLACEHOLDER,
    SCOPE_PLACEHOLDER,
    LEVEL_PLACEHOLDER,
    INDENT_PLACEHOLDER,
    LINK_FILE_PLACEHOLDER,
    WORKSPACE_PLACEHOLDER,
    CONFIG_FILE_PLACEHOLDER,
    MESSAGE_FILE_PLACEHOLDER,
    SETTING_ONLY_PLACEHOLDER,
} from '#cli/config/runs/command.ts';

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

function listConfigFiles(session: Session, planned: PlannedCheck): ConfigFile[] {
    const own = planned.scope.configurations
        .filter((configuration) => configuration.checks.some((check) => check.id === planned.check.id))
        .flatMap((configuration) => configuration.configFiles);
    const every = session.configurationsByName
        .values()
        .flatMap((configuration) => configuration.configFiles)
        .toArray();
    return [...own, ...every];
}

function selectLinkFilePath(session: Session, scopePath: string, name: string): string {
    const path = joinScope(scopePath, name);
    const generated = listGeneratedPaths(session.repository.files);
    return !generated.has(path) && generated.has(name) ? name : path;
}

function expandArgument(
    session: Session,
    planned: PlannedCheck,
    argument: string,
    substitutions: Substitutions,
): CommandArgument[] {
    if (argument === FILES_PLACEHOLDER) return substitutions.files;
    if (argument === FILE_PLACEHOLDER) return [{ file: true }];
    const workspace = WORKSPACE_PLACEHOLDER.exec(argument)?.[1];
    if (workspace !== undefined)
        return substitutions.scope !== '' && listWorkspaceFolders(substitutions.root).includes(substitutions.scope)
            ? [workspace, substitutions.scope]
            : [];
    return [replacePlaceholders(session, planned, argument, substitutions)];
}

/**
Check whether a check that names {workspace:<flag>} runs in its scope folder. That happens when the scope holds its own
package.json and no workspace declares it. The tool then runs in that package as in a repository of its own, and
reports its paths from there.

@param root the repository, or the copy of it that the tool runs in.
@param planned the check and its scope.
*/
export function runsInPackageFolder(root: string, planned: PlannedCheck): boolean {
    const scopePath = planned.scope.path;
    if (scopePath === '' || !(planned.check.command ?? []).some((argument) => WORKSPACE_PLACEHOLDER.test(argument)))
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
export function getConfigFilePath(session: Session, planned: PlannedCheck, name: string): string {
    const configFile = listConfigFiles(session, planned).find(({ file }) => extractConfigFileName(file) === name);
    if (!configFile)
        throw new GspotError(
            'settings',
            `Check ${planned.check.id} names {config_file:${name}} and no configuration writes it.`,
        );
    return getConfigFileTarget(planned.scope.path, configFile, buildConfigFiles(session));
}

/**
Lists the config files that a check command or its environment names.

@param session the repository and its configurations.
@param planned the check that runs.
@param command the arguments to scan.
@returns the config file paths, relative to the root.
*/
export function listCommandConfigFiles(session: Session, planned: PlannedCheck, command: readonly string[]): string[] {
    const words = [...command, ...(planned.check.env === undefined ? [] : Object.values(planned.check.env))];
    const scope = planned.scope.path;
    return [
        ...new Set(
            words.flatMap((segment) => {
                const configured = segment
                    .matchAll(CONFIG_FILE_PLACEHOLDER)
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) => getConfigFilePath(session, planned, name))
                    .toArray();
                const pointed = segment
                    .matchAll(LINK_FILE_PLACEHOLDER)
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) => selectLinkFilePath(session, scope, name))
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
export function listCopyFiles(session: Session, planned: PlannedCheck, command: string[]): string[] {
    const scope = planned.scope.path;
    const owned = (planned.configuration?.configFiles ?? []).map((configFile) =>
        getConfigFileTarget(scope, configFile, buildConfigFiles(session)),
    );
    return [
        ...new Set([
            ...planned.files.map(({ path }) => path),
            ...listCommandConfigFiles(session, planned, command),
            ...owned,
        ]),
    ];
}

/**
Replace scalar setting placeholders with their scope values.

@param scopeSettings the values of the scope.
@param text the text with placeholders.
*/
export function replaceSettingPlaceholders(scopeSettings: ScopeSettings, text: string): string {
    return text.replaceAll(SETTING_PLACEHOLDER, (_match, name: string) => {
        const found = scopeSettings.valuesByKey[name];
        if (Array.isArray(found)) throw new TypeError(`List setting ${name} must occupy a whole command argument.`);
        return typeof found === 'string' || typeof found === 'number' || typeof found === 'boolean'
            ? String(found)
            : '';
    });
}

/**
Expands a scalar command argument or environment value from the check scope.

@param session the repository and settings.
@param planned the check and its scope.
@param argument the value with placeholders.
@param substitutions the expansion values.
*/
export function replacePlaceholders(
    session: Session,
    planned: PlannedCheck,
    argument: string,
    substitutions: Substitutions,
): string {
    return replaceSettingPlaceholders(planned.scope.settings, argument)
        .replaceAll(LEVEL_PLACEHOLDER, (_match, defaultLevel: string, all: string) =>
            session.settings.level === 'all' ? all : defaultLevel,
        )
        .replaceAll(CONFIG_FILE_PLACEHOLDER, (_match, name: string) =>
            join(substitutions.root, getConfigFilePath(session, planned, name))
                .split('/')
                .join(sep),
        )
        .replaceAll(LINK_FILE_PLACEHOLDER, (_match, name: string) =>
            selectLinkFilePath(session, substitutions.scope, name).split('/').join(sep),
        )
        .replaceAll(SCOPE_PLACEHOLDER, () => (substitutions.scope === '' ? '.' : substitutions.scope))
        .replaceAll(ROOT_PLACEHOLDER, () => substitutions.root)
        .replaceAll(INDENT_PLACEHOLDER, () => String(substitutions.indent))
        .replaceAll(MESSAGE_FILE_PLACEHOLDER, () => substitutions.messageFile ?? '');
}

/**
Expands setting and scope placeholders, and keeps a marker for each file slot.

@param session the repository and settings.
@param planned the check and its scope.
@param command the arguments as declared.
@param substitutions the expansion values.
*/
export function expandCommand(
    session: Session,
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
