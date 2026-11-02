import { posix } from 'node:path';
import { readFileSync } from 'node:fs';
import { isTable } from '#cli/system/tables.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { listAssets, buildAssetPath } from '#cli/system/assets.ts';
import { GspotError, formatZodIssue } from '#cli/system/errors.ts';
import { manifestSchema } from '#cli/schemas/manifests/manifest.ts';
import { compareText, formatSimilarNames } from '#cli/system/text.ts';
import { RULES_FOLDER, MANIFEST_FILE, CONFIGURATIONS_FOLDER, DEFAULT_OUTPUT_FORMAT } from '#cli/config/manifests.ts';

import type {
    Tool,
    Check,
    ShippedRule,
    Configuration,
    ManifestSource,
    ParsedManifest,
    ConfigurationCheck,
} from '#cli/types/manifests.ts';

let shippedConfigurations: Map<string, Configuration> | undefined;

function buildConfigurations(manifests: ParsedManifest[]): Map<string, Configuration> {
    const toolsByName = listManifestTools(manifests);
    return new Map(
        manifests.map(({ configuration, tools, checks, ...fields }) => [
            configuration.name,
            {
                ...fields,
                ...configuration,
                checks: checks.map((check) => ({
                    ...check,
                    output:
                        check.output ??
                        toolsByName.get(check.tool ?? check.command?.[0] ?? '')?.output ??
                        DEFAULT_OUTPUT_FORMAT,
                })),
                tools: tools.map((tool) => {
                    if (typeof tool !== 'string') return tool;
                    const found = toolsByName.get(tool);
                    if (found === undefined)
                        throw new GspotError(
                            'configuration',
                            `The configuration manifest for ${configuration.name} is not valid:\ntool ${tool} has no declaration.`,
                        );
                    return found;
                }),
            },
        ]),
    );
}

function parseManifest(text: string, folder: string): ParsedManifest {
    const parsed = parseToml(text) as Record<string, unknown>;
    const result = manifestSchema.safeParse({
        ...parsed,
        folder: folder,
        configuration: {
            ...(isTable(parsed['configuration']) && parsed['configuration']),
            name: posix.basename(folder),
            group: posix.basename(posix.dirname(folder)),
        },
    });
    if (!result.success)
        throw new GspotError(
            'configuration',
            [
                `The configuration manifest for ${posix.basename(folder)} is not valid:`,
                ...new Set(result.error.issues.flatMap((issue) => formatZodIssue(issue))),
            ].join('\n'),
        );
    return result.data;
}

function listManifestTools(manifests: Iterable<ParsedManifest>): Map<string, Tool> {
    const tools = new Map<string, Tool>();
    for (const manifest of manifests) {
        const declarations = manifest.tools.values().filter((tool) => typeof tool !== 'string');
        for (const tool of declarations) {
            const previous = tools.get(tool.name);
            if (previous !== undefined)
                throw new GspotError(
                    'configuration',
                    `The configuration manifest for ${manifest.configuration.name} is not valid:\ntool ${tool.name} is already declared.`,
                );
            tools.set(tool.name, tool);
        }
    }
    return tools;
}

/**
Parse manifest texts into configurations, sorted by name, and refuse an invalid manifest.

@param manifests the folder of each configuration and the text of its manifest.
*/
export function parseConfigurations(manifests: readonly ManifestSource[]): Map<string, Configuration> {
    return buildConfigurations(
        manifests
            .map(({ folder, text }) => parseManifest(text, folder))
            .toSorted((first, second) => compareText(first.configuration.name, second.configuration.name)),
    );
}

/**
Read every configuration once per process.
*/
export function readConfigurations(): ReadonlyMap<string, Configuration> {
    if (shippedConfigurations !== undefined) return shippedConfigurations;
    shippedConfigurations = parseConfigurations(
        listAssets(`${CONFIGURATIONS_FOLDER}/`)
            .filter((path) => path.endsWith(`/${MANIFEST_FILE}`))
            .map((path) => ({
                folder: path.slice(0, -`/${MANIFEST_FILE}`.length),
                text: readFileSync(buildAssetPath(path), 'utf8'),
            })),
    );
    const ruleNames = shippedConfigurations
        .values()
        .flatMap((configuration) => listRuleFiles(configuration).map(({ path }) => path))
        .toArray();
    const repeated = ruleNames.find((name, index) => ruleNames.indexOf(name) !== index);
    if (repeated !== undefined) throw new Error(`Two configurations ship a rule file named ${repeated}.`);
    return shippedConfigurations;
}

/**
List the shipped check IDs and the command check IDs of the repository.

@param checks the [[command_check]] records.
@returns the shipped IDs, then your command check IDs.
*/
export function listCheckIds(checks: ReadonlyArray<Pick<Check, 'id'>>): string[] {
    const shipped = listChecksById(readConfigurations().values()).keys().toArray();
    const authored = checks.map((check) => check.id);
    return [...shipped, ...authored];
}

/**
List the files in the rules folder of a configuration.

@param configuration the shipped configuration that owns the rule files.
*/
export function listRuleFiles(configuration: Configuration): ShippedRule[] {
    const { group } = configuration;
    const sources = listAssets(`${configuration.folder}/${RULES_FOLDER}/`);
    return sources.map((source) => ({
        source,
        group,
        path: posix.basename(source),
    }));
}

/**
Index the declared checks by ID, with the configuration of each.

@param configurations the configurations that declare the checks.
*/
export function listChecksById(configurations: Iterable<Configuration>): Map<string, ConfigurationCheck> {
    const checks = new Map<string, ConfigurationCheck>();
    for (const configuration of configurations) {
        for (const check of configuration.checks) {
            checks.set(check.id, { check, configuration });
        }
    }
    return checks;
}

/**
Refuse a check ID that no configuration or command check declares.

@param checkId the requested check ID.
@param commandChecks the authored command checks.
*/
export function assertCheckExists(checkId: string, commandChecks: ReadonlyArray<Pick<Check, 'id'>>): void {
    const checkIds = listCheckIds(commandChecks);
    if (!checkIds.includes(checkId))
        throw new GspotError(
            'arguments',
            `There is no check called ${checkId}.${formatSimilarNames(checkId, checkIds)}`,
        );
}

/**
Read the global naming choices from the naming manifest.
*/
export function readNamingDefaults(): NonNullable<Configuration['naming']> {
    const naming = readConfigurations().get('naming')?.naming;
    if (naming === undefined) throw new Error('The naming manifest has no naming table.');
    return naming;
}
