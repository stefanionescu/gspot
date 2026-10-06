// Expand manifest commands using the planned scope, files, tools, and settings.
import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { readText } from '#cli/platform/source.ts';
import { toPlatform } from '#cli/platform/paths.ts';
import type { Session } from '#cli/types/execution/session.ts';
import type { PlannedCheck } from '#cli/types/execution/runtime.ts';
import type { ConfigurationFile } from '#cli/types/configurations.ts';
import { targetInScope, configurationName } from '#cli/configurations/declarations.ts';
import type { CommandPart, Substitutions, CommandInvocation } from '#cli/types/execution/command.ts';

import {
    EACH_PLACEHOLDER,
    FILE_PLACEHOLDER,
    WORKSPACE_PREFIX,
    FILES_PLACEHOLDER,
    CONFIG_PLACEHOLDER,
    POINTER_PLACEHOLDER,
    SETTING_PLACEHOLDER,
    EXISTING_PLACEHOLDER,
} from '#cli/config/parsers/command.ts';

/**
 * Expands an each part, or returns undefined when the part is something else.
 * @param planned the check, whose scope holds the settings
 * @param part one part of the manifest command
 * @returns the arguments, empty when the list is empty
 */
function listArguments(planned: PlannedCheck, part: string): string[] | undefined {
    const groups = EACH_PLACEHOLDER.exec(part)?.groups;
    if (groups === undefined) return undefined;
    const held = planned.scope.view.settings[groups['setting'] ?? ''] as string[] | string | undefined;
    const items = typeof held === 'string' ? [held].filter((item) => item !== '') : (held ?? []);
    return items.flatMap((item) => [groups['flag'] ?? '', toPlatform(item)]);
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

function allConfigurations(session: Session, planned: PlannedCheck): ConfigurationFile[] {
    // A check's own targets come first because configurationPath selects the first matching target.
    const own = planned.manifest?.configs ?? [];
    const every = session.manifests
        .values()
        .flatMap((manifest) => manifest.configs)
        .toArray();
    return [...own, ...every];
}

function configurationPath(session: Session, planned: PlannedCheck, name: string): string {
    const target = allConfigurations(session, planned).find(
        (config) => !config.fragment && configurationName(config.target) === name,
    );
    if (!target) throw new Error(`Check ${planned.spec.name} names {config:${name}} and no configuration renders it.`);
    return targetInScope(planned.scope.scope.path, target);
}

function plainPart(session: Session, planned: PlannedCheck, part: string, substitutions: Substitutions): CommandPart[] {
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
function nestedConfigurations(session: Session, planned: PlannedCheck): string[] {
    const nested = planned.spec.nested_config_file;
    if (nested === undefined) return [];
    const scope = planned.scope.scope.path;
    const paths = [
        posix.join(scope, nested),
        ...allConfigurations(session, planned)
            .filter((config) => !config.fragment && config.stub_file?.path === nested)
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
    session: Session,
    planned: PlannedCheck,
    command = planned.spec.command ?? [],
): string[] {
    const parts = [...command, ...(planned.spec.env === undefined ? [] : Object.values(planned.spec.env))];
    const scope = planned.scope.scope.path;
    return [
        ...new Set([
            ...nestedConfigurations(session, planned),
            ...parts.flatMap((part) => {
                const configured = [...part.matchAll(CONFIG_PLACEHOLDER)]
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
export function isolatedFiles(session: Session, planned: PlannedCheck, command: string[]): string[] {
    const scope = planned.scope.scope.path;
    const owned = (planned.manifest?.configs ?? [])
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
    session: Session,
    planned: PlannedCheck,
    part: string,
    substitutions: Substitutions,
): string {
    return part
        .replaceAll(SETTING_PLACEHOLDER, (_match, name: string) => {
            const found = planned.scope.view.settings[name];
            return typeof found === 'string' || typeof found === 'number' || typeof found === 'boolean'
                ? String(found)
                : '';
        })
        .replaceAll(CONFIG_PLACEHOLDER, (_match, name: string) =>
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
    session: Session,
    planned: PlannedCheck,
    command: string[],
    substitutions: Substitutions,
): CommandPart[] {
    return command.flatMap((part) => {
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
