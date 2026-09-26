import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { Session } from '#cli/execution/session.ts';
import { toPlatform } from '#cli/platform/paths.ts';
import type { PlannedCheck } from '#cli/execution/plan.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { ConfigurationTarget } from '#cli/configurations/schema.ts';
import { configurationName, targetInScope } from '#cli/configurations/targets.ts';
import { isWorkspace } from '#cli/repository/scopes.ts';

const CONFIG_PLACEHOLDER = /\{config:(?<name>[a-z0-9-]+)\}/gu;
const POINTER_PLACEHOLDER = /\{pointer:(?<name>[^}]+)\}/gu;
const WORKSPACE_PREFIX = '{workspace:';
const SETTING_PLACEHOLDER = /\{setting:(?<name>[a-z\d_.-]+)\}/gu;
const EXISTING_PLACEHOLDER = /^\{existing:(?<flag>[^:]+):(?<path>[^}]+)\}$/u;
const EACH_PLACEHOLDER = /^\{each:(?<flag>[^:]+):(?<setting>[a-z0-9_.-]+)\}$/u;
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
 * Replaces every setting placeholder in a command part with the value the policy holds.
 * @param planned the check, whose scope holds the settings
 * @param part one part of the manifest command
 * @returns the part with the values in place; a setting with no value becomes an empty string
 */
function settingsFilled(planned: PlannedCheck, part: string): string {
    return part.replaceAll(SETTING_PLACEHOLDER, (_match, name: string) => {
        const found = planned.scope.view.settings[name];
        return typeof found === 'string' || typeof found === 'number' || typeof found === 'boolean'
            ? String(found)
            : '';
    });
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
    return statSync(path, { throwIfNoEntry: false }) !== undefined ? [groups['flag'] ?? '', toPlatform(path)] : [];
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
    const target = allConfigs(session, planned).find(
        (config) => !config.fragment && configurationName(config.target) === name,
    );
    if (!target) throw new Error(`Check ${planned.check} names {config:${name}} and no configuration renders it.`);
    return targetInScope(planned.scope.scope.path, target);
}

function pointerPath(name: string, scope: string): string {
    return scope === '' ? name : `${scope}/${name}`;
}
/**
 * Configuration paths named by a check command or its environment.
 * @param session
 * @param planned
 * @param command
 */
export function commandConfigurations(
    session: Session,
    planned: PlannedCheck,
    command = planned.spec.command ?? [],
): string[] {
    const parts = [...command, ...Object.values(planned.spec.env ?? {})];
    const scope = planned.scope.scope.path;
    const implicit: string[] = [];
    const nested = planned.spec.nested_config;
    if (nested !== undefined) {
        const files = openConfinedRoot(session.root);
        try {
            const required = [
                scope === '' ? nested : `${scope}/${nested}`,
                ...allConfigs(session, planned)
                    .filter((config) => !config.fragment && config.pointer?.path === nested)
                    .map((config) => targetInScope(scope, config)),
            ];
            implicit.push(...required);
            for (const file of planned.files) {
                for (
                    let directory = posix.dirname(file.path);
                    directory !== '.' && directory !== scope;
                    directory = posix.dirname(directory)
                ) {
                    const path = `${directory}/${nested}`;
                    if (!implicit.includes(path) && files.read(path) !== undefined) implicit.push(path);
                }
            }
        } finally {
            files.close();
        }
    }
    return [
        ...new Set([
            ...implicit,
            ...parts.flatMap((part) => [
                ...Array.from(part.matchAll(CONFIG_PLACEHOLDER), (match) =>
                    configurationPath(session, planned, match.groups!['name']!),
                ),
                ...Array.from(part.matchAll(POINTER_PLACEHOLDER), (match) =>
                    pointerPath(match.groups!['name']!, scope),
                ),
                ...(EXISTING_PLACEHOLDER.exec(part)?.groups?.['path'] === undefined
                    ? []
                    : [EXISTING_PLACEHOLDER.exec(part)!.groups!['path']!]),
            ]),
        ]),
    ].toSorted((left, right) => left.localeCompare(right));
}

function expandPart(session: Session, planned: PlannedCheck, part: string, sub: Substitutions): CommandPart[] {
    const policyPart = listArguments(planned, part) ?? existingFileArguments(session.root, part);
    return policyPart ?? plainPart(session, planned, part, sub);
}

function plainPart(session: Session, planned: PlannedCheck, part: string, sub: Substitutions): CommandPart[] {
    if (part === '{files}') return sub.files;
    if (part === '{file}') return [{ file: true }];
    if (part.startsWith(WORKSPACE_PREFIX) && part.endsWith('}'))
        return isWorkspace(session.root, sub.scope) ? [part.slice(WORKSPACE_PREFIX.length, -1), sub.scope] : [];
    return [substituteValue(session, planned, part, sub)];
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
    return settingsFilled(planned, part)
        .replaceAll(CONFIG_PLACEHOLDER, (_match, name: string) =>
            toPlatform(join(session.root, configurationPath(session, planned, name))),
        )
        .replaceAll(POINTER_PLACEHOLDER, (_match, name: string) => toPlatform(pointerPath(name, sub.scope)))
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
    return command.flatMap((part) => expandPart(session, planned, part, sub));
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

export type CommandPart = string | { file: true };

export type Substitutions = {
    files: string[];
    scope: string;
    root: string;
    messageFile?: string;
    indent: number;
};

/** A tool command expanded and ready to spawn: once, or once per file. */
export type ToolInvocation = { argv: string[]; file?: string };
