import { statSync } from 'node:fs';
import { join, sep } from 'node:path';

import {
    COMMAND_PLACEHOLDER,
    EACH_PLACEHOLDER,
    FILE_PLACEHOLDER,
    FILES_PLACEHOLDER,
    FORMATTER_CHECKS,
    SETTING_ONLY_PLACEHOLDER,
    WORKSPACE_PLACEHOLDER,
} from '#cli/config/engine.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { getConfigPath, selectPointerPath } from '#cli/engine/run/tool-runs/configs.ts';
import { addPluginExtensions } from '#cli/repository/files/selection.ts';
import { listWorkspaceFolders } from '#cli/repository/projects/workspaces.ts';
import { formatScope } from '#cli/repository/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckSession } from '#cli/types/engine/run.ts';
import type { CommandArgument, CommandLine, Substitutions } from '#cli/types/engine/tool-runs.ts';
import type { ScopeSettings } from '#cli/types/settings.ts';

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
        return substitutions.scopePath !== '' &&
            listWorkspaceFolders(substitutions.root).includes(substitutions.scopePath)
            ? [workspace, substitutions.scopePath]
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
        pointer: (name) => selectPointerPath(session, substitutions.scopePath, name).split('/').join(sep),
        formatted_extensions: () => buildFormattedExtensions(planned),
        scope: () => formatScope(substitutions.scopePath),
        root: () => substitutions.root,
        message_file: () => substitutions.messageFile ?? '',
    };
}

/**
Check whether a check that names {workspace:<flag>} runs in its scope folder. That happens when the scope holds its own
package.json and no workspace declares it. The tool then runs in that package as in a repository of its own, and
reports its paths from there.
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

export function getScalarSetting(scopeSettings: ScopeSettings, name: string): string {
    const found = scopeSettings.valuesByKey[name];
    if (Array.isArray(found))
        throw new GspotError('settings', `List setting ${name} must occupy a whole command argument.`);
    return typeof found === 'string' || typeof found === 'number' || typeof found === 'boolean' ? String(found) : '';
}

/**
Expands a scalar command argument or environment value from the check scope. One pass reads the whole text, so a value
that a setting supplies stays literal.
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

export function buildFileCommandLines(command: CommandArgument[], files: string[]): CommandLine[] {
    const hasFile = command.some((segment) => typeof segment !== 'string');
    return (hasFile ? files : ['']).map((file) => ({
        commandArguments: command.map((argument) => (typeof argument === 'string' ? argument : file)),
        ...(hasFile && { file }),
    }));
}
