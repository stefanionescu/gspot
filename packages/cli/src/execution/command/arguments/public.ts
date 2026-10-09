import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { toPlatform } from '#cli/platform/contracts.ts';
import { readText } from '#cli/platform/root/public.ts';
import type { ToolFileDeclaration } from '#cli/types/configurations.ts';
import { toolFileName, targetInScope } from '#cli/configurations/contracts.ts';

import type {
    CommandPart,
    CommandCheck,
    CommandSource,
    Substitutions,
    CommandInvocation,
} from '#cli/types/execution/command.ts';
import {
    EACH_PLACEHOLDER,
    FILE_PLACEHOLDER,
    WORKSPACE_PREFIX,
    FILES_PLACEHOLDER,
    POINTER_PLACEHOLDER,
    SETTING_PLACEHOLDER,
    EXISTING_PLACEHOLDER,
    TOOL_FILE_PLACEHOLDER,
} from '#cli/config/configurations.ts';

// Native list values are consumed by both argv splicing and existing each-flag expansion.
function commandItems(value: unknown, name: string): string[] {
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string'))
        throw new Error(`Command setting ${name} must contain only string arguments.`);
    return value;
}

/**
 * Expands an each part, or returns undefined when the part is something else.
 * @param planned the check, whose scope holds the settings
 * @param part one part of the manifest command
 * @returns the arguments, empty when the list is empty
 */
function listArguments(planned: CommandCheck, part: string): string[] | undefined {
    const groups = EACH_PLACEHOLDER.exec(part)?.groups;
    if (groups === undefined) return undefined;
    const name = groups['setting'] ?? '';
    const held = planned.scope.view.settings[name];
    const items = typeof held === 'string' ? [held].filter((item) => item !== '') : (held ?? []);
    return commandItems(items, name).flatMap((item) => [groups['flag'] ?? '', toPlatform(item)]);
}

/**
 * Expands {existing:<flag>:<path>}: the flag and the absolute path when the file exists, and nothing when it does not.
 * @param root the repository root
 * @param part one part of the manifest command
 * @returns the arguments, or undefined when the part is something else
 */
function existingFileArguments(root: string, part: string): string[] | undefined {
    const groups = EXISTING_PLACEHOLDER.exec(part)?.groups;
    if (groups === undefined) return undefined;
    const path = join(root, groups['path'] ?? '');
    return statSync(path, { throwIfNoEntry: false }) === undefined ? [] : [groups['flag'] ?? '', toPlatform(path)];
}

function allConfigurations(session: CommandSource, planned: CommandCheck): ToolFileDeclaration[] {
    // A check's own targets come first because configurationPath selects the first matching target.
    const own = planned.manifest?.toolFiles ?? [];
    const every = session.manifests
        .values()
        .flatMap((manifest) => manifest.toolFiles)
        .toArray();
    return [...own, ...every];
}

function configurationPath(session: CommandSource, planned: CommandCheck, name: string): string {
    const target = allConfigurations(session, planned).find(
        (config) => !config.fragment && toolFileName(config.target) === name,
    );
    if (!target)
        throw new Error(`Check ${planned.check.name} names {tool_file:${name}} and no configuration writes it.`);
    return targetInScope(planned.scope.scope.path, target);
}

function plainPart(
    session: CommandSource,
    planned: CommandCheck,
    part: string,
    substitutions: Substitutions,
): CommandPart[] {
    if (part === FILES_PLACEHOLDER) return substitutions.files;
    if (part === FILE_PLACEHOLDER) return [{ file: true }];
    if (part.startsWith(WORKSPACE_PREFIX) && part.endsWith('}')) {
        if (
            substitutions.scope === '' ||
            statSync(join(session.root, substitutions.scope, 'package.json'), { throwIfNoEntry: false }) === undefined
        )
            return [];
        return [part.slice(WORKSPACE_PREFIX.length, -1), substitutions.scope];
    }
    return [substituteValue(session, planned, part, substitutions)];
}

// The nested config files a check reads: its scope's own, its pointers, and those between an input and its scope.
function nestedConfigurations(session: CommandSource, planned: CommandCheck): string[] {
    const nested = planned.check.nested_config_file;
    if (nested === undefined) return [];
    const scope = planned.scope.scope.path;
    const paths = [
        posix.join(scope, nested),
        ...allConfigurations(session, planned)
            .filter((config) => !config.fragment && config.pointer?.path === nested)
            .map((config) => targetInScope(scope, config)),
    ];
    const ancestors = planned.files.flatMap((file) => {
        const found: string[] = [];
        for (
            let directory = posix.dirname(file.path);
            directory !== '.' && directory !== scope;
            directory = posix.dirname(directory)
        )
            found.push(posix.join(directory, nested));
        return found;
    });
    for (const path of ancestors) {
        if (!paths.includes(path) && readText(session.root, path, session.reads) !== undefined) paths.push(path);
    }
    return paths;
}

/**
 * Configuration paths named by a check command or its environment.
 * @param session the open session
 * @param planned the planned check
 * @param command the command to read, the check's own by default
 * @returns the configuration paths, relative to the root
 */
export function commandConfigurations(
    session: CommandSource,
    planned: CommandCheck,
    command = planned.check.command ?? [],
): string[] {
    const parts = [...command, ...(planned.check.env === undefined ? [] : Object.values(planned.check.env))];
    const scope = planned.scope.scope.path;
    return [
        ...new Set([
            ...nestedConfigurations(session, planned),
            ...parts.flatMap((part) => {
                const configured = [...part.matchAll(TOOL_FILE_PLACEHOLDER)]
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) => configurationPath(session, planned, name));
                const pointed = [...part.matchAll(POINTER_PLACEHOLDER)]
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) => posix.join(scope, name));
                const existing = EXISTING_PLACEHOLDER.exec(part)?.groups?.['path'];
                return [...configured, ...pointed, ...(existing === undefined ? [] : [existing])];
            }),
        ]),
    ].toSorted((left, right) => left.localeCompare(right));
}

/**
 * Select source and configuration files needed by an isolated command.
 * @param session the source repository session
 * @param planned the check and its selected files
 * @param command the command with configuration placeholders
 * @returns repository-relative paths for the isolated workspace
 */
export function isolatedFiles(session: CommandSource, planned: CommandCheck, command: string[]): string[] {
    const scope = planned.scope.scope.path;
    const owned = (planned.manifest?.toolFiles ?? [])
        .filter((config) => !config.fragment)
        .map((config) => targetInScope(scope, config));
    return [
        ...new Set([
            ...planned.files.map(({ path }) => path),
            ...commandConfigurations(session, planned, command),
            ...owned,
        ]),
    ];
}

/**
 * Expands a scalar command argument or environment value from the check scope.
 * @param session the repository session
 * @param planned the planned check
 * @param part the value with placeholders
 * @param substitutions the expansion values
 * @returns the expanded value
 */
export function substituteValue(
    session: CommandSource,
    planned: CommandCheck,
    part: string,
    substitutions: Substitutions,
): string {
    return part
        .replaceAll(SETTING_PLACEHOLDER, (_match, name: string) => {
            const found = planned.scope.view.settings[name];
            if (Array.isArray(found)) throw new Error(`List setting ${name} must occupy a whole command argument.`);
            return typeof found === 'string' || typeof found === 'number' || typeof found === 'boolean'
                ? String(found)
                : '';
        })
        .replaceAll(TOOL_FILE_PLACEHOLDER, (_match, name: string) =>
            toPlatform(join(session.root, configurationPath(session, planned, name))),
        )
        .replaceAll(POINTER_PLACEHOLDER, (_match, name: string) => toPlatform(posix.join(substitutions.scope, name)))
        .replaceAll('{scope}', () => (substitutions.scope === '' ? '.' : substitutions.scope))
        .replaceAll('{root}', () => substitutions.root)
        .replaceAll('{indent}', () => String(substitutions.indent))
        .replaceAll('{message_file}', () => substitutions.messageFile ?? '');
}

/**
 * Expands policy and scope arguments while retaining individual file slots.
 * @param session the repository session
 * @param planned the planned check
 * @param command the original command
 * @param substitutions the expansion values
 * @returns argument text and file markers
 */
export function substitute(
    session: CommandSource,
    planned: CommandCheck,
    command: string[],
    substitutions: Substitutions,
): CommandPart[] {
    return command.flatMap((part) => {
        const setting = SETTING_PLACEHOLDER.exec(part);
        SETTING_PLACEHOLDER.lastIndex = 0;
        if (setting?.[0] === part) {
            const name = part.slice('{setting:'.length, -1);
            const value = planned.scope.view.settings[name];
            if (Array.isArray(value)) return commandItems(value, name);
        }

        const policyPart = listArguments(planned, part) ?? existingFileArguments(session.root, part);
        return policyPart ?? plainPart(session, planned, part, substitutions);
    });
}

/**
 * Replaces every file marker after variable-length arguments have expanded.
 * @param parts the expanded command
 * @param files the paths relative to the command directory
 * @returns one command per file, or one command when no file marker exists
 */
export function perFileCommands(parts: CommandPart[], files: string[]): CommandInvocation[] {
    const hasFile = parts.some((part) => typeof part !== 'string');
    return (hasFile ? files : ['']).map((file) => ({
        argv: parts.map((part) => (typeof part === 'string' ? part : file)),
        ...(hasFile ? { file } : {}),
    }));
}
