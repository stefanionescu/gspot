import { posix } from 'node:path';
import { readFileSync } from 'node:fs';
import { isTable } from '#cli/system/tables.ts';
import { formatSimilarNames } from '#cli/system/text.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import type { ShippedRule } from '#cli/types/generation/rules.ts';
import { listAssets, buildAssetPath } from '#cli/system/assets.ts';
import { GspotError, formatZodIssue } from '#cli/system/errors.ts';
import { manifestSchema } from '#cli/schemas/configurations/manifest.ts';
import type { Tool, Check, Configuration, ParsedManifest, ConfigurationCheck } from '#cli/types/configurations.ts';

import {
    RULES_FOLDER,
    MANIFEST_FILE,
    CONFIGURATIONS_FOLDER,
    SHIPPED_TOOL_FILES_FOLDER,
} from '#cli/config/configurations.ts';

// Every run shares the immutable declarations shipped with the package.
let CONFIGURATIONS: Map<string, Configuration> | undefined;

// A configuration with exactly one tool gives that tool to each tool file that names none.
function findOnlyToolName(tools: unknown): string | undefined {
    if (!Array.isArray(tools) || tools.length !== 1) return undefined;
    const tool: unknown = tools.at(0);
    return isTable(tool) && typeof tool['name'] === 'string' ? tool['name'] : undefined;
}

// Add a tool file for each file in the tool-files folder that no [[tool_file]] record names.
function readToolFiles(configurationFolder: string, toolFiles: unknown, tools: unknown): unknown {
    if (toolFiles !== undefined && !Array.isArray(toolFiles)) return toolFiles;
    const entries: unknown[] = toolFiles === undefined ? [] : toolFiles;
    const declaredTargets = new Set(entries.flatMap((entry) => (isTable(entry) ? [entry['target']] : [])));
    const folder = `${configurationFolder}/${SHIPPED_TOOL_FILES_FOLDER}/`;
    const copied = listAssets(folder)
        .map((path) => ({ target: posix.relative(folder, path) }))
        .filter(({ target }) => !declaredTargets.has(target));
    const tool = findOnlyToolName(tools);
    return [...entries, ...copied].map((entry) =>
        tool === undefined || !isTable(entry) || entry['tool'] !== undefined || entry['check'] !== undefined
            ? entry
            : { ...entry, tool },
    );
}

/**
 * Link each named tool to the [[tool]] table that declares it.
 *
 * @param manifests the parsed configurations.
 * @returns the configurations by name, with each tool in full.
 */
function buildConfigurations(manifests: ParsedManifest[]): Map<string, Configuration> {
    const entries = listDeclaredTools(manifests);
    return new Map(
        manifests.map(({ configuration, tools, ...fields }) => [
            configuration.name,
            {
                ...fields,
                ...configuration,
                tools: tools.map((tool) => {
                    if (typeof tool !== 'string') return tool;
                    const declared = entries.get(tool);
                    if (declared === undefined)
                        throw buildManifestError(configuration.name, [`tool ${tool} has no declaration.`]);
                    return declared;
                }),
            },
        ]),
    );
}

/**
 * Parse one manifest.toml text into a validated configuration; invalid text throws GspotError with code configuration.
 *
 * @param text the `manifest.toml` content.
 * @param configurationFolder the asset path that gives the name and group.
 * @returns the configuration, with qualified check IDs and the tool files found in its folder.
 */
function parseManifest(text: string, configurationFolder: string): ParsedManifest {
    const parsed = parseToml(text) as Record<string, unknown>;
    const toolFiles = parsed['tool_file'];
    const discoveredToolFiles = readToolFiles(configurationFolder, toolFiles, parsed['tool']);
    const result = manifestSchema.safeParse({
        ...parsed,
        tool_file: discoveredToolFiles,
        folder: configurationFolder,
        configuration: {
            ...(isTable(parsed['configuration']) ? parsed['configuration'] : {}),
            name: posix.basename(configurationFolder),
            group: posix.basename(posix.dirname(configurationFolder)),
        },
    });
    if (!result.success)
        throw buildManifestError(posix.basename(configurationFolder), [
            ...new Set(result.error.issues.flatMap((issue) => formatZodIssue(issue))),
        ]);
    return result.data;
}

// Parse every shipped manifest, and link each tool name to the [[tool]] table that declares it. MANIFESTS keeps the
// result for the read cache.
function readShippedConfigurations(): Map<string, Configuration> {
    const manifests = new Map<string, ParsedManifest>();
    const paths = listAssets(`${CONFIGURATIONS_FOLDER}/`).filter((path) => path.endsWith(`/${MANIFEST_FILE}`));
    for (const path of paths) {
        const folder = path.slice(0, -`/${MANIFEST_FILE}`.length);
        const manifest = parseManifest(readFileSync(buildAssetPath(path), 'utf8'), folder);
        manifests.set(manifest.configuration.name, manifest);
    }
    return buildConfigurations(
        [...manifests.values()].toSorted((first, second) =>
            first.configuration.name.localeCompare(second.configuration.name),
        ),
    );
}

/**
 * Build the error for a manifest that fails validation.
 *
 * @param configuration the name of the failing manifest.
 * @param errors the messages in plain English.
 * @returns the error to throw.
 */
export function buildManifestError(configuration: string, errors: string[]): GspotError {
    return new GspotError(
        'configuration',
        [`The configuration manifest for \`${configuration}\` is not valid:`, ...errors].join('\n'),
    );
}

/**
 * Read every configuration once per process.
 *
 * @returns the configurations by name.
 */
export function readConfigurations(): Map<string, Configuration> {
    CONFIGURATIONS ??= readShippedConfigurations();
    return CONFIGURATIONS;
}

/**
 * List the shipped check IDs and the command check IDs of the repository.
 *
 * @param checks the [[command_check]] records.
 * @returns the shipped IDs, then your command check IDs.
 */
export function listCheckIds(checks: readonly Pick<Check, 'id'>[]): string[] {
    const shipped = [...listChecksById(readConfigurations().values()).keys()];
    const authored = checks.map((check) => check.id);
    return [...new Set([...shipped, ...authored])];
}

/**
 * List the files in the rules folder of a configuration.
 *
 * @param configuration the shipped configuration that owns the rule files.
 * @returns each file with its asset source, its group, and its path under the configurations folder.
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
 * Index the declared checks by ID, with the configuration of each.
 *
 * @param configurations the shipped bundles that own the declared checks.
 * @returns the declared checks by ID.
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
 * Index the tools by name, and refuse a tool that two configurations declare.
 *
 * @param manifests the parsed configurations.
 * @returns the tools by name.
 */
function listDeclaredTools(manifests: Iterable<ParsedManifest>): Map<string, Tool> {
    const tools = new Map<string, Tool>();
    for (const manifest of manifests)
        for (const tool of manifest.tools.filter((entry) => typeof entry !== 'string')) {
            const previous = tools.get(tool.name);
            if (previous !== undefined)
                throw buildManifestError(manifest.configuration.name, [`tool ${tool.name} is already declared.`]);
            tools.set(tool.name, tool);
        }
    return tools;
}

/**
 * Refuse a check ID that no configuration or command check declares.
 *
 * @param name the requested check ID.
 * @param settings the command checks of gspot.toml.
 */
export function assertKnownCheck(name: string, settings: Pick<Settings, 'commandChecks'>): void {
    const known = listCheckIds(Object.values(settings.commandChecks));
    if (!known.includes(name))
        throw new GspotError('arguments', `There is no check called ${name}.${formatSimilarNames(name, known)}`);
}
