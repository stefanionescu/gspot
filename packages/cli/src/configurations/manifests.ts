import { posix } from 'node:path';
import { readFileSync } from 'node:fs';
import { isTable } from '#cli/system/tables.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import type { ShippedRule } from '#cli/types/generation/rules.ts';
import { listAssets, buildAssetPath } from '#cli/system/assets.ts';
import { GspotError, formatZodIssue } from '#cli/system/errors.ts';
import { compareText, formatSimilarNames } from '#cli/system/text.ts';
import { manifestSchema } from '#cli/schemas/configurations/manifest.ts';
import { CONFIGURATIONS_FOLDER } from '#cli/config/configurations/names.ts';
import { RULES_FOLDER, MANIFEST_FILE } from '#cli/config/configurations/manifests.ts';
import type { Tool, Check, Configuration, ParsedManifest, ConfigurationCheck } from '#cli/types/configurations.ts';

let shippedConfigurations: Map<string, Configuration> | undefined;

function buildConfigurations(manifests: ParsedManifest[]): Map<string, Configuration> {
    const toolsByName = listManifestTools(manifests);
    return new Map(
        manifests.map(({ configuration, tools, ...fields }) => [
            configuration.name,
            {
                ...fields,
                ...configuration,
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

/**
Read every configuration once per process.
*/
export function readConfigurations(): Map<string, Configuration> {
    if (shippedConfigurations !== undefined) return shippedConfigurations;
    const manifests = new Map<string, ParsedManifest>();
    const paths = listAssets(`${CONFIGURATIONS_FOLDER}/`).filter((path) => path.endsWith(`/${MANIFEST_FILE}`));
    for (const path of paths) {
        const folder = path.slice(0, -`/${MANIFEST_FILE}`.length);
        const manifest = parseManifest(readFileSync(buildAssetPath(path), 'utf8'), folder);
        manifests.set(manifest.configuration.name, manifest);
    }
    shippedConfigurations = buildConfigurations(
        manifests
            .values()
            .toArray()
            .toSorted((first, second) => compareText(first.configuration.name, second.configuration.name)),
    );

    return shippedConfigurations;
}

/**
List the shipped check IDs and the command check IDs of the repository.

@param checks the [[command_check]] records.
@returns the shipped IDs, then your command check IDs.
*/
export function listCheckIds(checks: readonly Pick<Check, 'id'>[]): string[] {
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
        path: posix.relative(CONFIGURATIONS_FOLDER, source),
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
Refuse a check ID that no configuration or command check declares.

@param checkId the requested check ID.
@param settings the command checks of gspot.toml.
*/
export function assertCheckExists(checkId: string, settings: Pick<Settings, 'commandChecks'>): void {
    const checkIds = listCheckIds(Object.values(settings.commandChecks));
    if (!checkIds.includes(checkId))
        throw new GspotError(
            'arguments',
            `There is no check called ${checkId}.${formatSimilarNames(checkId, checkIds)}`,
        );
}
