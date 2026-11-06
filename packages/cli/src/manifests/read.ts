import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

import { CONFIGURATIONS_FOLDER, DEFAULT_OUTPUT_FORMAT, MANIFEST_FILE, RULES_FOLDER } from '#cli/config/manifests.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { manifestSchema } from '#cli/schemas/manifests/manifest.ts';
import { buildAssetPath, listAssets } from '#cli/system/assets.ts';
import { formatZodIssue, GspotError } from '#cli/system/errors.ts';
import { isTable } from '#cli/system/tables.ts';
import { compareText, formatSimilarNames } from '#cli/system/text.ts';
import type {
    Check,
    Configuration,
    ConfigurationCheck,
    ManifestSource,
    ParsedManifest,
    ShippedRule,
} from '#cli/types/manifests.ts';

const shipped: { configurations?: Map<string, Configuration> } = {};

function buildConfigurations(manifests: ParsedManifest[]): Map<string, Configuration> {
    const toolsByName = new Map(
        manifests.flatMap((manifest) =>
            manifest.tools.filter((tool) => typeof tool !== 'string').map((tool) => [tool.name, tool] as const),
        ),
    );
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
                        throw new Error(
                            `The configuration manifest for ${configuration.name} is not valid:\ntool ${tool} has no declaration.`,
                        );
                    return found;
                }),
            },
        ]),
    );
}

function parseManifest(text: string, folder: string): ParsedManifest {
    const parsed = parseTomlFile(`${folder}/${MANIFEST_FILE}`, text);
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
        throw new Error(
            [
                `The configuration manifest for ${posix.basename(folder)} is not valid:`,
                ...new Set(result.error.issues.flatMap((issue) => formatZodIssue(issue))),
            ].join('\n'),
        );
    return result.data;
}

export function parseConfigurations(manifests: readonly ManifestSource[]): Map<string, Configuration> {
    return buildConfigurations(
        manifests
            .map(({ folder, text }) => parseManifest(text, folder))
            .toSorted((first, second) => compareText(first.configuration.name, second.configuration.name)),
    );
}

export function readConfigurations(): ReadonlyMap<string, Configuration> {
    if (shipped.configurations !== undefined) return shipped.configurations;
    const configurations = parseConfigurations(
        listAssets(`${CONFIGURATIONS_FOLDER}/`)
            .filter((path) => path.endsWith(`/${MANIFEST_FILE}`))
            .map((path) => ({
                folder: path.slice(0, -`/${MANIFEST_FILE}`.length),
                text: readFileSync(buildAssetPath(path), 'utf8'),
            })),
    );
    shipped.configurations = configurations;
    return configurations;
}

export function listCheckIds(checks: ReadonlyArray<Pick<Check, 'id'>>): string[] {
    const shipped = listChecksById(readConfigurations().values()).keys().toArray();
    const authored = checks.map((check) => check.id);
    return [...shipped, ...authored];
}

export function listRuleFiles(configuration: Configuration): ShippedRule[] {
    const { group } = configuration;
    const sources = listAssets(`${configuration.folder}/${RULES_FOLDER}/`);
    return sources.map((source) => ({
        source,
        group,
        path: posix.basename(source),
    }));
}

export function listChecksById(configurations: Iterable<Configuration>): Map<string, ConfigurationCheck> {
    const checks = new Map<string, ConfigurationCheck>();
    for (const configuration of configurations) {
        for (const check of configuration.checks) {
            checks.set(check.id, { check, configuration });
        }
    }
    return checks;
}

export function assertCheckExists(checkId: string, commandChecks: ReadonlyArray<Pick<Check, 'id'>>): void {
    const checkIds = listCheckIds(commandChecks);
    if (!checkIds.includes(checkId))
        throw new GspotError(
            'arguments',
            `There is no check called ${checkId}.${formatSimilarNames(checkId, checkIds)}`,
        );
}

export function readNamingDefaults(): NonNullable<Configuration['naming']> {
    const naming = readConfigurations().get('naming')?.naming;
    if (naming === undefined) throw new Error('The naming manifest has no naming table.');
    return naming;
}
