import { parseDocument } from '@decimalturn/toml-patch';
import { similar, codeList } from '#cli/platform/contracts.ts';
import { toolFileName } from '#cli/configurations/contracts.ts';
import { isComment, isKeyValue } from '#cli/parsers/toml/contracts.ts';
import { MANIFEST_TABLE_ORDER, TOOL_FILE_PLACEHOLDER } from '#cli/config/configurations.ts';

import type {
    Manifest,
    CheckRule,
    ParsedCheck,
    ParsedManifest,
    UnknownConfiguration,
    ConfigurationDeclaration,
} from '#cli/types/configurations.ts';

// Each way a check declaration contradicts itself, with the sentence that reports it.
const CHECK_RULES: CheckRule[] = [
    {
        applies: (check) => check.nested_config_file !== undefined && check.cwd !== 'scope',
        error: (check) => `check ${check.name} discovers nested configuration and requires cwd = scope.`,
    },
    {
        applies: (check) =>
            check.path_prefix !== undefined && (check.runs !== 'files' || check.command?.includes('{files}') !== true),
        error: (check) =>
            `check ${check.name} prefixes file arguments and requires runs = "files" with {files} in its command.`,
    },
    {
        applies: (check) => {
            if (check.run_in_copy !== true) return false;
            const perFile = check.runs === 'files' && check.command?.includes('{files}') === true;
            const perScope =
                check.runs === 'scope' && check.command?.some((argument) => argument.includes('{root}')) === true;
            return !perFile && !perScope;
        },
        error: (check) =>
            `check ${check.name} isolates files and requires runs = "files" with {files} or runs = "scope" with {root}.`,
    },
    {
        applies: (check) => check.needs !== undefined && check.stage === 'commit',
        error: (check) =>
            `check ${check.name} needs ${check.needs?.join(', ') ?? ''} and cannot run at the commit stage.`,
    },
    {
        applies: ({ stage, needs, runs, command }) =>
            stage === 'manual' && needs === undefined && runs === 'files' && command === undefined,
        error: (check) => `check ${check.name} is manual with nothing that makes it slow.`,
    },
];

function toolFileReaders(checks: ParsedCheck[]): Set<string> {
    const readers = new Set<string>();
    for (const check of checks)
        for (const argument of [
            ...(check.command ?? []),
            ...(check.fix ?? []),
            ...(check.env === undefined ? [] : Object.values(check.env)),
        ])
            for (const match of argument.matchAll(TOOL_FILE_PLACEHOLDER)) readers.add(match[1] ?? '');
    return readers;
}

// Native table headers retain source order; nested values have no separate header.
function manifestTableErrors(text: string): string[] {
    let previous = 0;
    return parseDocument(text).cst.flatMap((node): string[] => {
        if (isComment(node) || isKeyValue(node)) return [];
        const table = node.key.item.value.join('.');
        const position = MANIFEST_TABLE_ORDER.indexOf(table);
        if (position === -1) return [`line ${String(node.loc.start.line)}: write ${table} as an inline value.`];
        // Each tool owns its replacement tables, before the next tool.
        const order = table === 'tool.replace' ? MANIFEST_TABLE_ORDER.indexOf('tool') : position;
        if (order < previous) return [`line ${String(node.loc.start.line)}: ${table} is out of manifest table order.`];
        previous = order;
        return [];
    });
}

/**
 * Contradictory check declarations and generated configurations with no reader or pointer.
 * @param raw the parsed manifest
 * @param text the authored native TOML declaration
 * @returns contradictory declarations and config files without a declared reader
 */
export function manifestErrors(raw: ParsedManifest, text: string): string[] {
    const checks = raw.checks.flatMap((check) =>
        CHECK_RULES.filter((rule) => rule.applies(check)).map((rule) => rule.error(check)),
    );
    const declarations = [...manifestTableErrors(text), ...checks];
    const readers = toolFileReaders(raw.checks);
    // Built-in checks read assets in source; command placeholders cannot prove which configs they use.
    if (raw.checks.some((check) => check.command === undefined)) return declarations;
    // A config that needs another configuration is read by that configuration's check, as Semgrep reads every pack in its folder.
    const configurations = raw.toolFiles
        .filter((config) => !config.fragment && config.pointer === undefined && config.when === undefined)
        .filter((config) => {
            const name = toolFileName(config.target);
            const isReadByTemplate = raw.toolFiles.some(
                (other) => other !== config && other.source?.includes(name) === true,
            );
            return !readers.has(name) && !isReadByTemplate;
        })
        .map(
            (config) =>
                `config ${config.target} has no check that reads it ({tool_file:${toolFileName(config.target)}}) and no pointer.`,
        );
    return [...declarations, ...configurations];
}

/**
 * Names an unavailable configuration and suggests nearby declared names.
 * @param name the requested configuration
 * @param known the declared configuration names
 * @returns the public diagnostic
 */
export function unknownConfigurationDiagnostic(name: string, known: string[]): string {
    const suggestions = similar(name, known);
    return `There is no configuration called \`${name}\`.${suggestions.length > 0 ? ' Did you mean ' + codeList(suggestions) + '?' : ''} Run \`gspot list configurations\` to see the available configurations.`;
}

/**
 * Reports unknown configuration names without losing their declaration order or location.
 * @param declarations the requested names, with their original fields
 * @param manifests the declared configurations
 * @returns each unknown declaration with its public diagnostic
 */
export function unknownConfigurations<Declaration extends Pick<ConfigurationDeclaration, 'name'>>(
    declarations: readonly Declaration[],
    manifests: ReadonlyMap<string, Manifest>,
): UnknownConfiguration<Declaration>[] {
    const known = [...manifests.keys()];
    return declarations
        .filter(({ name }) => !manifests.has(name))
        .map((declaration) => ({
            ...declaration,
            message: unknownConfigurationDiagnostic(declaration.name, known),
        }));
}
