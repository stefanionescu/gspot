import { join } from 'node:path';
import { statSync } from 'node:fs';
import { type Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { convertToSystemPath } from '#cli/system/paths.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import type { ConfigFile } from '#cli/types/configurations.ts';
import { listGeneratedPaths } from '#cli/repository/files/classify.ts';
import { getConfigFiles } from '#cli/generation/config-files/generate.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { extractConfigFileName } from '#cli/configurations/declared-tools.ts';
import { getConfigFileTarget } from '#cli/generation/config-files/selection.ts';
import { FILE_PLACEHOLDER, SETTING_PLACEHOLDER } from '#cli/config/placeholders.ts';
import type { CommandLine, CommandPart, Substitutions } from '#cli/types/runs/command.ts';

import {
    ROOT_PLACEHOLDER,
    EACH_PLACEHOLDER,
    FILES_PLACEHOLDER,
    SCOPE_PLACEHOLDER,
    LEVEL_PLACEHOLDER,
    INDENT_PLACEHOLDER,
    POINTER_PLACEHOLDER,
    EXISTING_PLACEHOLDER,
    WORKSPACE_PLACEHOLDER,
    CONFIG_FILE_PLACEHOLDER,
    MESSAGE_FILE_PLACEHOLDER,
    WHOLE_SETTING_PLACEHOLDER,
} from '#cli/config/runs/command/placeholders.ts';

function assertArgumentList(value: unknown, name: string): string[] {
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string'))
        throw new Error(`Command setting ${name} must contain only string arguments.`);
    return value;
}

/**
 * Expand {each:<flag>:<setting>}: the flag before each item of the list setting.
 *
 * @param planned the check, whose scope holds the settings.
 * @param part one argument of the manifest command.
 * @returns the expanded arguments, or undefined for another part kind.
 */
function expandEachPlaceholder(planned: PlannedCheck, part: string): string[] | undefined {
    const groups = EACH_PLACEHOLDER.exec(part)?.groups;
    if (groups === undefined) return undefined;
    const name = groups['setting'] ?? '';
    const held = planned.scope.settings.settings[name];
    const items = held ?? [];
    return assertArgumentList(items, name).flatMap((item) => [groups['flag'] ?? '', convertToSystemPath(item)]);
}

/**
 * Expands {existing:<flag>:<path>}: the flag and the absolute path when the file exists, and nothing when it does not.
 *
 * @param repositoryRoot the folder that manifest paths start from.
 * @param part one argument of the manifest command.
 * @returns the arguments, or undefined for another part kind.
 */
function expandExistingPlaceholder(repositoryRoot: string, part: string): string[] | undefined {
    const groups = EXISTING_PLACEHOLDER.exec(part)?.groups;
    if (groups === undefined) return undefined;
    const path = join(repositoryRoot, groups['path'] ?? '');
    return statSync(path, { throwIfNoEntry: false }) === undefined
        ? []
        : [groups['flag'] ?? '', convertToSystemPath(path)];
}

function listConfigFiles(session: Session, planned: PlannedCheck): ConfigFile[] {
    // The config files of the configurations of the check come first, because the lookup takes the first match.
    const own = planned.scope.configurations
        .filter((configuration) => configuration.checks.some((check) => check.id === planned.check.id))
        .flatMap((configuration) => configuration.configFiles);
    const every = session.configurations
        .values()
        .flatMap((configuration) => configuration.configFiles)
        .toArray();
    return [...own, ...every];
}

function selectPointerPath(session: Session, scope: string, name: string): string {
    const path = joinScope(scope, name);
    const generated = listGeneratedPaths(session.repository.files);
    return !generated.has(path) && generated.has(name) ? name : path;
}

function expandPlainPart(
    session: Session,
    planned: PlannedCheck,
    part: string,
    substitutions: Substitutions,
): CommandPart[] {
    if (part === FILES_PLACEHOLDER) return substitutions.files;
    if (part === FILE_PLACEHOLDER) return [{ file: true }];
    const workspace = WORKSPACE_PLACEHOLDER.exec(part)?.groups?.['name'];
    if (workspace !== undefined) {
        if (
            substitutions.scope === '' ||
            statSync(join(session.root, substitutions.scope, PACKAGE_JSON), { throwIfNoEntry: false }) === undefined
        )
            return [];
        return [workspace, substitutions.scope];
    }
    return [replacePlaceholders(session, planned, part, substitutions)];
}

/**
 * Find the config file that {config_file:<name>} names, with the configurations of the check first.
 *
 * @param session the repository and its configurations.
 * @param planned the check that names it.
 * @param name the config file path without its extensions.
 * @returns the [[config_file]] table of that config file.
 */
export function getConfigFile(session: Session, planned: PlannedCheck, name: string): ConfigFile {
    const target = listConfigFiles(session, planned).find(
        (configFile) => extractConfigFileName(configFile.file) === name,
    );
    if (!target)
        throw new Error(`Check ${planned.check.id} names {config_file:${name}} and no configuration writes it.`);
    return target;
}

/**
 * Lists the config files that a check command or its environment names.
 *
 * @param session the repository and its configurations.
 * @param planned the check that runs.
 * @param command the arguments to scan.
 * @returns the config file paths, relative to the root.
 */
export function listCommandConfigFiles(session: Session, planned: PlannedCheck, command: readonly string[]): string[] {
    const parts = [...command, ...(planned.check.env === undefined ? [] : Object.values(planned.check.env))];
    const scope = planned.scope.folder.path;
    return [
        ...new Set(
            parts.flatMap((part) => {
                const configured = [...part.matchAll(CONFIG_FILE_PLACEHOLDER)]
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) =>
                        getConfigFileTarget(
                            planned.scope.folder.path,
                            getConfigFile(session, planned, name),
                            getConfigFiles(session).targets,
                        ),
                    );
                const pointed = [...part.matchAll(POINTER_PLACEHOLDER)]
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) => selectPointerPath(session, scope, name));
                const existing = EXISTING_PLACEHOLDER.exec(part)?.groups?.['path'];
                return [...configured, ...pointed, ...(existing === undefined ? [] : [existing])];
            }),
        ),
    ].toSorted((left, right) => left.localeCompare(right));
}

/**
 * Lists the source and config files that a copy needs for a command.
 *
 * @param session the repository and its configurations.
 * @param planned the check and its files.
 * @param command the arguments, with config file placeholders.
 * @returns repository-relative paths for the copy.
 */
export function listCopyFiles(session: Session, planned: PlannedCheck, command: string[]): string[] {
    const scope = planned.scope.folder.path;
    const owned = (planned.configuration?.configFiles ?? []).map((configFile) =>
        getConfigFileTarget(scope, configFile, getConfigFiles(session).targets),
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
 * Expands a scalar command argument or environment value from the check scope.
 *
 * @param session the repository and settings.
 * @param planned the check and its scope.
 * @param part the value with placeholders.
 * @param substitutions the expansion values.
 * @returns the expanded value.
 */
export function replacePlaceholders(
    session: Session,
    planned: PlannedCheck,
    part: string,
    substitutions: Substitutions,
): string {
    return part
        .replaceAll(LEVEL_PLACEHOLDER, (_match, recommended: string, all: string) =>
            session.settingsFile.settings.level === 'all' ? all : recommended,
        )
        .replaceAll(SETTING_PLACEHOLDER, (_match, name: string) => {
            const found = planned.scope.settings.settings[name];
            if (Array.isArray(found)) throw new Error(`List setting ${name} must occupy a whole command argument.`);
            return typeof found === 'string' || typeof found === 'number' || typeof found === 'boolean'
                ? String(found)
                : '';
        })
        .replaceAll(CONFIG_FILE_PLACEHOLDER, (_match, name: string) =>
            convertToSystemPath(
                join(
                    session.root,
                    getConfigFileTarget(
                        planned.scope.folder.path,
                        getConfigFile(session, planned, name),
                        getConfigFiles(session).targets,
                    ),
                ),
            ),
        )
        .replaceAll(POINTER_PLACEHOLDER, (_match, name: string) =>
            convertToSystemPath(selectPointerPath(session, substitutions.scope, name)),
        )
        .replaceAll(SCOPE_PLACEHOLDER, () => (substitutions.scope === '' ? '.' : substitutions.scope))
        .replaceAll(ROOT_PLACEHOLDER, () => substitutions.root)
        .replaceAll(INDENT_PLACEHOLDER, () => String(substitutions.indent))
        .replaceAll(MESSAGE_FILE_PLACEHOLDER, () => substitutions.messageFile ?? '');
}

/**
 * Expands setting and scope placeholders, and keeps a marker for each file slot.
 *
 * @param session the repository and settings.
 * @param planned the check and its scope.
 * @param command the arguments as declared.
 * @param substitutions the expansion values.
 * @returns argument text and file markers.
 */
export function expandCommand(
    session: Session,
    planned: PlannedCheck,
    command: string[],
    substitutions: Substitutions,
): CommandPart[] {
    return command.flatMap((part) => {
        const name = WHOLE_SETTING_PLACEHOLDER.exec(part)?.groups?.['name'];
        if (name !== undefined) {
            const value = planned.scope.settings.settings[name];
            if (Array.isArray(value)) return assertArgumentList(value, name);
        }

        const settingsPart = expandEachPlaceholder(planned, part) ?? expandExistingPlaceholder(session.root, part);
        return settingsPart ?? expandPlainPart(session, planned, part, substitutions);
    });
}

/**
 * Replaces every file marker after variable-length arguments have expanded.
 *
 * @param parts the expanded command.
 * @param files the paths relative to the working folder.
 * @returns one command per file, or one command when no file marker exists.
 */
export function buildFileCommandLines(parts: CommandPart[], files: string[]): CommandLine[] {
    const hasFile = parts.some((part) => typeof part !== 'string');
    return (hasFile ? files : ['']).map((file) => ({
        commandArguments: parts.map((part) => (typeof part === 'string' ? part : file)),
        ...(hasFile ? { file } : {}),
    }));
}
