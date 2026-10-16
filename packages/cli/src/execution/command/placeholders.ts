import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { convertToSystemPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { extractToolFileName } from '#cli/planning/files.ts';
import { buildScopeTarget } from '#cli/repository/scopes.ts';
import type { ToolFileDeclaration } from '#cli/types/configurations.ts';

import type {
    CommandPart,
    CommandSource,
    Substitutions,
    SubstitutionCheck,
    CommandInvocation,
} from '#cli/types/execution/command.ts';
import {
    EACH_PLACEHOLDER,
    FILE_PLACEHOLDER,
    ROOT_PLACEHOLDER,
    FILES_PLACEHOLDER,
    LEVEL_PLACEHOLDER,
    SCOPE_PLACEHOLDER,
    INDENT_PLACEHOLDER,
    POINTER_PLACEHOLDER,
    SETTING_PLACEHOLDER,
    EXISTING_PLACEHOLDER,
    TOOL_FILE_PLACEHOLDER,
    WORKSPACE_PLACEHOLDER,
    MESSAGE_FILE_PLACEHOLDER,
    WHOLE_SETTING_PLACEHOLDER,
} from '#cli/config/configurations.ts';

// Use native list values in argument splicing and each-flag expansion.
function commandItems(value: unknown, name: string): string[] {
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string'))
        throw new Error(`Command setting ${name} must contain only string arguments.`);
    return value;
}

/**
 * Expands an each part, or returns undefined for another part kind.
 *
 * @param planned the check, whose scope holds the settings.
 * @param part one part of the manifest command.
 *
 * @returns the expanded arguments.
 */
function listArguments(planned: SubstitutionCheck, part: string): string[] | undefined {
    const groups = EACH_PLACEHOLDER.exec(part)?.groups;
    if (groups === undefined) return undefined;
    const name = groups['setting'] ?? '';
    const held = planned.scope.view.settings[name];
    const items = held ?? [];
    return commandItems(items, name).flatMap((item) => [groups['flag'] ?? '', convertToSystemPath(item)]);
}

/**
 * Expands {existing:<flag>:<path>}: the flag and the absolute path when the file exists, and nothing when it does not.
 *
 * @param root the repository root.
 * @param part one part of the manifest command.
 *
 * @returns the arguments, or undefined for another part kind.
 */
function existingFileArguments(root: string, part: string): string[] | undefined {
    const groups = EXISTING_PLACEHOLDER.exec(part)?.groups;
    if (groups === undefined) return undefined;
    const path = join(root, groups['path'] ?? '');
    return statSync(path, { throwIfNoEntry: false }) === undefined
        ? []
        : [groups['flag'] ?? '', convertToSystemPath(path)];
}

function allToolFiles(session: CommandSource, planned: SubstitutionCheck): ToolFileDeclaration[] {
    // A check's own targets come first because toolFilePath selects the first matching target.
    const own = planned.scope.selected
        .filter((manifest) => manifest.checks.some((check) => check.name === planned.check.name))
        .flatMap((manifest) => manifest.toolFiles);
    const every = session.manifests
        .values()
        .flatMap((manifest) => manifest.toolFiles)
        .toArray();
    return [...own, ...every];
}

function pointerFilePath(session: CommandSource, scope: string, name: string): string {
    const path = posix.join(scope, name);
    const generated = session.generatedPaths();
    return !generated.has(path) && generated.has(name) ? name : path;
}

function plainPart(
    session: CommandSource,
    planned: SubstitutionCheck,
    part: string,
    substitutions: Substitutions,
): CommandPart[] {
    if (part === FILES_PLACEHOLDER) return substitutions.files;
    if (part === FILE_PLACEHOLDER) return [{ file: true }];
    const workspace = WORKSPACE_PLACEHOLDER.exec(part)?.groups?.['name'];
    if (workspace !== undefined) {
        if (
            substitutions.scope === '' ||
            statSync(join(session.root, substitutions.scope, 'package.json'), { throwIfNoEntry: false }) === undefined
        )
            return [];
        return [workspace, substitutions.scope];
    }
    return [substituteValue(session, planned, part, substitutions)];
}

/**
 * Tool file path.
 *
 * @param session the repository session.
 * @param planned the selected check and its files.
 * @param name the tool or setting name.
 *
 * @returns the selected generated tool-file path.
 */
export function toolFilePath(session: CommandSource, planned: SubstitutionCheck, name: string): string {
    const target = allToolFiles(session, planned).find(
        (config) => !config.fragment && extractToolFileName(config.target) === name,
    );
    if (!target)
        throw new Error(`Check ${planned.check.name} names {tool_file:${name}} and no configuration writes it.`);
    return buildScopeTarget(planned.scope.scope.path, target, session.generatedPaths());
}

/**
 * Tool file paths named by a check command or its environment.
 *
 * @param session the open session.
 * @param planned the planned check.
 * @param command the command to read, the check's own by default.
 *
 * @returns the tool file paths, relative to the root.
 */
export function commandToolFiles(
    session: CommandSource,
    planned: SubstitutionCheck,
    command = planned.check.command ?? [],
): string[] {
    const parts = [...command, ...(planned.check.env === undefined ? [] : Object.values(planned.check.env))];
    const scope = planned.scope.scope.path;
    return [
        ...new Set(
            parts.flatMap((part) => {
                const configured = [...part.matchAll(TOOL_FILE_PLACEHOLDER)]
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) => toolFilePath(session, planned, name));
                const pointed = [...part.matchAll(POINTER_PLACEHOLDER)]
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) => pointerFilePath(session, scope, name));
                const existing = EXISTING_PLACEHOLDER.exec(part)?.groups?.['path'];
                return [...configured, ...pointed, ...(existing === undefined ? [] : [existing])];
            }),
        ),
    ].toSorted((left, right) => left.localeCompare(right));
}

/**
 * Select source and tool files needed by an isolated command.
 *
 * @param session the source repository session.
 * @param planned the check and its selected files.
 * @param command the command with tool-file placeholders.
 *
 * @returns repository-relative paths for the scratch copy.
 */
export function scratchFiles(
    session: CommandSource,
    planned: SubstitutionCheck & Pick<PlannedCheck, 'manifest'>,
    command: string[],
): string[] {
    const scope = planned.scope.scope.path;
    const owned = (planned.manifest?.toolFiles ?? [])
        .filter((config) => !config.fragment)
        .map((config) => buildScopeTarget(scope, config, session.generatedPaths()));
    return [
        ...new Set([
            ...planned.files.map(({ path }) => path),
            ...commandToolFiles(session, planned, command),
            ...owned,
        ]),
    ];
}

/**
 * Expands a scalar command argument or environment value from the check scope.
 *
 * @param session the repository session.
 * @param planned the planned check.
 * @param part the value with placeholders.
 * @param substitutions the expansion values.
 *
 * @returns the expanded value.
 */
export function substituteValue(
    session: CommandSource,
    planned: SubstitutionCheck,
    part: string,
    substitutions: Substitutions,
): string {
    return part
        .replaceAll(LEVEL_PLACEHOLDER, (_match, recommended: string, all: string) =>
            session.settingsFile.settings.level === 'all' ? all : recommended,
        )
        .replaceAll(SETTING_PLACEHOLDER, (_match, name: string) => {
            const found = planned.scope.view.settings[name];
            if (Array.isArray(found)) throw new Error(`List setting ${name} must occupy a whole command argument.`);
            return typeof found === 'string' || typeof found === 'number' || typeof found === 'boolean'
                ? String(found)
                : '';
        })
        .replaceAll(TOOL_FILE_PLACEHOLDER, (_match, name: string) =>
            convertToSystemPath(join(session.root, toolFilePath(session, planned, name))),
        )
        .replaceAll(POINTER_PLACEHOLDER, (_match, name: string) =>
            convertToSystemPath(pointerFilePath(session, substitutions.scope, name)),
        )
        .replaceAll(SCOPE_PLACEHOLDER, () => (substitutions.scope === '' ? '.' : substitutions.scope))
        .replaceAll(ROOT_PLACEHOLDER, () => substitutions.root)
        .replaceAll(INDENT_PLACEHOLDER, () => String(substitutions.indent))
        .replaceAll(MESSAGE_FILE_PLACEHOLDER, () => substitutions.messageFile ?? '');
}

/**
 * Expands settings and scope arguments while retaining individual file slots.
 *
 * @param session the repository session.
 * @param planned the planned check.
 * @param command the original command.
 * @param substitutions the expansion values.
 *
 * @returns argument text and file markers.
 */
export function substitute(
    session: CommandSource,
    planned: SubstitutionCheck,
    command: string[],
    substitutions: Substitutions,
): CommandPart[] {
    return command.flatMap((part) => {
        const name = WHOLE_SETTING_PLACEHOLDER.exec(part)?.groups?.['name'];
        if (name !== undefined) {
            const value = planned.scope.view.settings[name];
            if (Array.isArray(value)) return commandItems(value, name);
        }

        const settingsPart = listArguments(planned, part) ?? existingFileArguments(session.root, part);
        return settingsPart ?? plainPart(session, planned, part, substitutions);
    });
}

/**
 * Replaces every file marker after variable-length arguments have expanded.
 *
 * @param parts the expanded command.
 * @param files the paths relative to the command directory.
 *
 * @returns one command per file, or one command when no file marker exists.
 */
export function perFileCommands(parts: CommandPart[], files: string[]): CommandInvocation[] {
    const hasFile = parts.some((part) => typeof part !== 'string');
    return (hasFile ? files : ['']).map((file) => ({
        argv: parts.map((part) => (typeof part === 'string' ? part : file)),
        ...(hasFile ? { file } : {}),
    }));
}
