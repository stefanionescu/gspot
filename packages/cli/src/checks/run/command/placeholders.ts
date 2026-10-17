import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { convertToSystemPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { extractToolFileName } from '#cli/planning/files.ts';
import { buildScopeTarget } from '#cli/repository/scopes.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import type { ToolFileDeclaration } from '#cli/types/configurations.ts';

import type {
    CommandPart,
    CommandInputs,
    Substitutions,
    SubstitutionCheck,
    CommandInvocation,
} from '#cli/types/checks/run/command.ts';
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

function assertArgumentList(value: unknown, name: string): string[] {
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string'))
        throw new Error(`Command setting ${name} must contain only string arguments.`);
    return value;
}

/**
 * Expands an each part, or returns undefined for another part kind.
 * @param planned the check, whose scope holds the settings.
 * @param part one argument of the manifest command.
 * @returns the expanded arguments.
 */
function expandEachPlaceholder(planned: SubstitutionCheck, part: string): string[] | undefined {
    const groups = EACH_PLACEHOLDER.exec(part)?.groups;
    if (groups === undefined) return undefined;
    const name = groups['setting'] ?? '';
    const held = planned.scope.view.settings[name];
    const items = held ?? [];
    return assertArgumentList(items, name).flatMap((item) => [groups['flag'] ?? '', convertToSystemPath(item)]);
}

/**
 * Expands {existing:<flag>:<path>}: the flag and the absolute path when the file exists, and nothing when it does not.
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

function listToolFiles(session: CommandInputs, planned: SubstitutionCheck): ToolFileDeclaration[] {
    // The own targets of the check come first, because readToolFileDeclaration takes the first match.
    const own = planned.scope.selected
        .filter((manifest) => manifest.checks.some((check) => check.name === planned.check.name))
        .flatMap((manifest) => manifest.toolFiles);
    const every = session.manifests
        .values()
        .flatMap((manifest) => manifest.toolFiles)
        .toArray();
    return [...own, ...every];
}

function selectPointerPath(session: CommandInputs, scope: string, name: string): string {
    const path = posix.join(scope, name);
    const generated = session.generatedPaths();
    return !generated.has(path) && generated.has(name) ? name : path;
}

function expandPlainPart(
    session: CommandInputs,
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
            statSync(join(session.root, substitutions.scope, PACKAGE_JSON), { throwIfNoEntry: false }) === undefined
        )
            return [];
        return [workspace, substitutions.scope];
    }
    return [replacePlaceholders(session, planned, part, substitutions)];
}

/**
 * Finds the whole-file tool file declaration that a check names.
 * @param session the repository and manifests.
 * @param planned the check that names it.
 * @param name the tool or setting it belongs to.
 * @returns the declaration.
 */
export function readToolFileDeclaration(
    session: CommandInputs,
    planned: SubstitutionCheck,
    name: string,
): ToolFileDeclaration {
    const target = listToolFiles(session, planned).find(
        (toolFile) => !toolFile.fragment && extractToolFileName(toolFile.target) === name,
    );
    if (!target)
        throw new Error(`Check ${planned.check.name} names {tool_file:${name}} and no configuration writes it.`);
    return target;
}

/**
 * Resolves the tool file path for the scope of a check.
 * @param session the repository and tool file targets.
 * @param planned the check and its scope.
 * @param name the tool or setting it belongs to.
 * @returns the repository-relative path.
 */
export function selectToolFilePath(session: CommandInputs, planned: SubstitutionCheck, name: string): string {
    const target = readToolFileDeclaration(session, planned, name);
    return buildScopeTarget(planned.scope.scope.path, target, session.toolFiles().targets);
}

/**
 * Lists the tool files that a check command or its environment names.
 * @param session the repository and manifests.
 * @param planned the check that runs.
 * @param command the arguments to scan.
 * @returns the tool file paths, relative to the root.
 */
export function listCommandToolFiles(
    session: CommandInputs,
    planned: SubstitutionCheck,
    command: readonly string[],
): string[] {
    const parts = [...command, ...(planned.check.env === undefined ? [] : Object.values(planned.check.env))];
    const scope = planned.scope.scope.path;
    return [
        ...new Set(
            parts.flatMap((part) => {
                const configured = [...part.matchAll(TOOL_FILE_PLACEHOLDER)]
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) => selectToolFilePath(session, planned, name));
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
 * Lists the source and tool files that a scratch copy needs for a command.
 * @param session the repository and manifests.
 * @param planned the check and its files.
 * @param command the arguments, with tool file placeholders.
 * @returns repository-relative paths for the scratch copy.
 */
export function listScratchFiles(
    session: CommandInputs,
    planned: SubstitutionCheck & Pick<PlannedCheck, 'manifest'>,
    command: string[],
): string[] {
    const scope = planned.scope.scope.path;
    const owned = (planned.manifest?.toolFiles ?? [])
        .filter((toolFile) => !toolFile.fragment)
        .map((toolFile) => buildScopeTarget(scope, toolFile, session.toolFiles().targets));
    return [
        ...new Set([
            ...planned.files.map(({ path }) => path),
            ...listCommandToolFiles(session, planned, command),
            ...owned,
        ]),
    ];
}

/**
 * Expands a scalar command argument or environment value from the check scope.
 * @param session the repository and settings.
 * @param planned the check and its scope.
 * @param part the value with placeholders.
 * @param substitutions the expansion values.
 * @returns the expanded value.
 */
export function replacePlaceholders(
    session: CommandInputs,
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
            convertToSystemPath(join(session.root, selectToolFilePath(session, planned, name))),
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
 * @param session the repository and settings.
 * @param planned the check and its scope.
 * @param command the authored arguments.
 * @param substitutions the expansion values.
 * @returns argument text and file markers.
 */
export function expandCommand(
    session: CommandInputs,
    planned: SubstitutionCheck,
    command: string[],
    substitutions: Substitutions,
): CommandPart[] {
    return command.flatMap((part) => {
        const name = WHOLE_SETTING_PLACEHOLDER.exec(part)?.groups?.['name'];
        if (name !== undefined) {
            const value = planned.scope.view.settings[name];
            if (Array.isArray(value)) return assertArgumentList(value, name);
        }

        const settingsPart = expandEachPlaceholder(planned, part) ?? expandExistingPlaceholder(session.root, part);
        return settingsPart ?? expandPlainPart(session, planned, part, substitutions);
    });
}

/**
 * Replaces every file marker after variable-length arguments have expanded.
 * @param parts the expanded command.
 * @param files the paths relative to the working folder.
 * @returns one command per file, or one command when no file marker exists.
 */
export function buildFileInvocations(parts: CommandPart[], files: string[]): CommandInvocation[] {
    const hasFile = parts.some((part) => typeof part !== 'string');
    return (hasFile ? files : ['']).map((file) => ({
        commandArguments: parts.map((part) => (typeof part === 'string' ? part : file)),
        ...(hasFile ? { file } : {}),
    }));
}
