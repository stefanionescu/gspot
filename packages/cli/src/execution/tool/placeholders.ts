import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { toPlatform } from '#cli/platform/paths.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import { SETTING_PLACEHOLDER } from '#cli/config/kits.ts';
import type { ConfigurationTarget } from '#cli/types/kits.ts';
import { kitName, targetInScope } from '#cli/kits/targets.ts';
import type { PlannedCheck } from '#cli/types/execution/execution.ts';
import type { CommandPart, Substitutions, ToolInvocation } from '#cli/types/execution/tool.ts';

import {
    EACH_PLACEHOLDER,
    WORKSPACE_PREFIX,
    POINTER_PLACEHOLDER,
    EXISTING_PLACEHOLDER,
    COMMAND_CONFIG_PLACEHOLDER,
} from '#cli/config/execution/tool.ts';

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

function allConfigs(session: Session, planned: PlannedCheck): ConfigurationTarget[] {
    const own = planned.manifest?.configs ?? [];
    const every = session.manifests
        .values()
        .flatMap((manifest) => manifest.configs)
        .toArray();
    return [...own, ...every];
}

function configurationPath(session: Session, planned: PlannedCheck, name: string): string {
    const target = allConfigs(session, planned).find((config) => !config.fragment && kitName(config.target) === name);
    if (!target) throw new Error(`Check ${planned.check} names {config:${name}} and no configuration renders it.`);
    return targetInScope(planned.scope.scope.path, target);
}

function plainPart(session: Session, planned: PlannedCheck, part: string, sub: Substitutions): CommandPart[] {
    if (part === '{files}') return sub.files;
    if (part === '{file}') return [{ file: true }];
    if (part.startsWith(WORKSPACE_PREFIX) && part.endsWith('}')) {
        if (
            sub.scope === '' ||
            statSync(join(session.root, sub.scope, 'package.json'), { throwIfNoEntry: false }) === undefined
        )
            return [];
        return [part.slice(WORKSPACE_PREFIX.length, -1), sub.scope];
    }
    return [substituteValue(session, planned, part, sub)];
}

// Read only files ancestor configurations between each input and its declared scope.
function nestedConfigurations(session: Session, planned: PlannedCheck): string[] {
    const nested = planned.spec.nested_config;
    if (nested === undefined) return [];
    const scope = planned.scope.scope.path;
    using files = openRoot(session.root);
    const paths = [
        scope === '' ? nested : `${scope}/${nested}`,
        ...allConfigs(session, planned)
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
            found.push(`${directory}/${nested}`);
        return found;
    });
    for (const path of ancestors) {
        if (!paths.includes(path) && files.read(path) !== undefined) paths.push(path);
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
    const parts = [...command, ...Object.values(planned.spec.env ?? {})];
    const scope = planned.scope.scope.path;
    return [
        ...new Set([
            ...nestedConfigurations(session, planned),
            ...parts.flatMap((part) => {
                const configured = [...part.matchAll(COMMAND_CONFIG_PLACEHOLDER)]
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) => configurationPath(session, planned, name));
                const pointed = [...part.matchAll(POINTER_PLACEHOLDER)]
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) => (scope === '' ? name : `${scope}/${name}`));
                const existing = EXISTING_PLACEHOLDER.exec(part)?.groups?.['path'];
                return [...configured, ...pointed, ...(existing === undefined ? [] : [existing])];
            }),
        ]),
    ].toSorted((left, right) => left.localeCompare(right));
}
/**
 * Expands a scalar command argument or environment value from the check scope.
 * @param session the repository session
 * @param planned the planned check
 * @param part the value with placeholders
 * @param sub the expansion values
 * @returns the expanded value
 */
export function substituteValue(session: Session, planned: PlannedCheck, part: string, sub: Substitutions): string {
    return part
        .replaceAll(SETTING_PLACEHOLDER, (_match, name: string) => {
            const found = planned.scope.view.settings[name];
            return typeof found === 'string' || typeof found === 'number' || typeof found === 'boolean'
                ? String(found)
                : '';
        })
        .replaceAll(COMMAND_CONFIG_PLACEHOLDER, (_match, name: string) =>
            toPlatform(join(session.root, configurationPath(session, planned, name))),
        )
        .replaceAll(POINTER_PLACEHOLDER, (_match, name: string) =>
            toPlatform(sub.scope === '' ? name : `${sub.scope}/${name}`),
        )
        .replaceAll('{scope}', () => (sub.scope === '' ? '.' : sub.scope))
        .replaceAll('{root}', () => sub.root)
        .replaceAll('{indent}', () => String(sub.indent))
        .replaceAll('{message_file}', () => sub.messageFile ?? '');
}
/**
 * Expands policy and scope arguments while retaining individual file slots.
 * @param session the repository session
 * @param planned the planned check
 * @param command the original command
 * @param sub the expansion values
 * @returns argument text and file markers
 */
export function substitute(
    session: Session,
    planned: PlannedCheck,
    command: string[],
    sub: Substitutions,
): CommandPart[] {
    return command.flatMap((part) => {
        const policyPart = listArguments(planned, part) ?? existingFileArguments(session.root, part);
        return policyPart ?? plainPart(session, planned, part, sub);
    });
}
/**
 * Replaces every file marker after variable-length arguments have expanded.
 * @param parts the expanded command
 * @param files the paths relative to the command directory
 * @returns one command per file, or one command when no file marker exists
 */
export function perFileCommands(parts: CommandPart[], files: string[]): ToolInvocation[] {
    const hasFile = parts.some((part) => typeof part !== 'string');
    return (hasFile ? files : ['']).map((file) => ({
        argv: parts.map((part) => (typeof part === 'string' ? part : file)),
        ...(hasFile ? { file } : {}),
    }));
}
