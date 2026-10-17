import { posix } from 'node:path';
import type { ShippedRule } from '#cli/types/rules.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { readAsset, listAssets } from '#cli/system/assets.ts';
import { isRecord, stripUndefined } from '#cli/system/values.ts';
import { TOOL_FILE_PREFIX } from '#cli/config/system/locations.ts';
import { GspotError, formatZodIssue } from '#cli/system/errors.ts';
import { type NamingDefaults } from '#cli/types/checks/general.ts';
import { manifestSchema } from '#cli/configurations/schema/manifest.ts';
import { formatCodeList, selectSimilarNames } from '#cli/system/text.ts';
import { namingDefaultsSchema } from '#cli/configurations/schema/naming.ts';

import {
    RULES_FOLDER,
    MANIFEST_FILE,
    NAMING_DEFAULTS_FILE,
    CONFIGURATIONS_FOLDER,
    SHIPPED_TOOL_FILES_FOLDER,
} from '#cli/config/configurations.ts';
import {
    type Manifest,
    type ToolDeclaration,
    type CheckDeclaration,
    type ConfigurationCheck,
    type ManifestDeclaration,
} from '#cli/types/configurations.ts';

// Each read cache keeps its own copy of the shipped declarations.
const MANIFESTS = { create: readShippedManifests };

const NAMING_DEFAULTS = { create: readShippedNamingDefaults };

// Every tool-files asset has one canonical output; metadata adds consumers and generation settings.
function readToolFileDeclarations(configurationFolder: string, toolFiles: unknown): unknown {
    if (toolFiles !== undefined && !Array.isArray(toolFiles)) return toolFiles;
    const declarations: unknown[] = toolFiles === undefined ? [] : toolFiles;
    const declaredTargets = new Set(declarations.flatMap((entry) => (isRecord(entry) ? [entry['target']] : [])));
    const folder = `${configurationFolder}/${SHIPPED_TOOL_FILES_FOLDER}/`;
    const copied = listAssets(folder)
        .map((path) => ({ target: TOOL_FILE_PREFIX + posix.relative(folder, path) }))
        .filter(({ target }) => !declaredTargets.has(target));
    return [...declarations, ...copied];
}

/**
 * Link each named tool to its full declaration.
 * @param manifests the parsed configuration declarations.
 * @returns the manifests by name, with full tool declarations.
 */
function linkManifestTools(manifests: ManifestDeclaration[]): Map<string, Manifest> {
    const tools = listDeclaredTools(manifests);
    return new Map(
        manifests.map((manifest) => [
            manifest.configuration.name,
            {
                ...manifest,
                tools: manifest.tools.map((tool) => {
                    if (typeof tool !== 'string') return tool;
                    const declared = tools.get(tool);
                    if (declared === undefined)
                        throw buildManifestError(manifest.configuration.name, [`tool ${tool} has no declaration.`]);
                    return declared;
                }),
            },
        ]),
    );
}

/**
 * Parse one manifest text into validated declarations; invalid input throws GspotError with code manifest.
 * @param text the `manifest.toml` content.
 * @param configurationFolder the asset path that gives the name and group.
 * @returns validated declarations with qualified check IDs and discovered tool files.
 */
function parseManifest(text: string, configurationFolder: string): ManifestDeclaration {
    const parsed = parseToml(text) as Record<string, unknown>;
    const toolFiles = parsed['tool_file'];
    const discoveredToolFiles = readToolFileDeclarations(configurationFolder, toolFiles);
    const result = manifestSchema.safeParse({
        ...parsed,
        tool_file: discoveredToolFiles,
        configuration: {
            ...(isRecord(parsed['configuration']) ? parsed['configuration'] : {}),
            name: posix.basename(configurationFolder),
            group: posix.basename(posix.dirname(configurationFolder)),
        },
    });
    if (!result.success)
        throw buildManifestError(posix.basename(configurationFolder), [
            ...new Set(result.error.issues.flatMap((issue) => formatZodIssue(issue))),
        ]);
    const declared = result.data;
    // The check ID joins the configuration name and the check name.
    return {
        ...declared,
        checks: declared.checks.map((check) =>
            stripUndefined({ ...check, name: `${declared.configuration.name}/${check.name}` }),
        ),
        folder: configurationFolder,
    };
}

// Parse shipped declarations only for the first manifest read in one run.
function readShippedManifests(): Map<string, Manifest> {
    const manifests = new Map<string, ManifestDeclaration>();
    const paths = listAssets(`${CONFIGURATIONS_FOLDER}/`).filter((path) => path.endsWith(`/${MANIFEST_FILE}`));
    for (const path of paths) {
        const folder = path.slice(0, -`/${MANIFEST_FILE}`.length);
        const manifest = parseManifest(readAsset(path), folder);
        manifests.set(manifest.configuration.name, manifest);
    }
    return linkManifestTools(
        [...manifests.values()].toSorted((first, second) =>
            first.configuration.name.localeCompare(second.configuration.name),
        ),
    );
}

function readShippedNamingDefaults(): NamingDefaults {
    return namingDefaultsSchema.parse(JSON.parse(readAsset(NAMING_DEFAULTS_FILE)));
}

/**
 * Build the error for a manifest that fails validation.
 * @param configuration the name of the failing manifest.
 * @param errors the messages in plain English.
 * @returns the error to throw.
 */
function buildManifestError(configuration: string, errors: string[]): GspotError {
    return new GspotError(
        'manifest',
        [`The configuration manifest for \`${configuration}\` is not valid:`, ...errors].join('\n'),
    );
}

/**
 * Read every manifest once per run.
 * @param reads the run cache.
 * @returns the manifests by configuration name.
 */
function readManifests(reads: ReadCache): Map<string, Manifest> {
    return getCachedValue(reads, MANIFESTS);
}

/**
 * List the shipped check IDs and the command check IDs of the repository.
 * @param checks the [[command_check]] records.
 * @param reads the run cache.
 * @returns the shipped IDs, then your command check IDs.
 */
function listCheckIds(checks: readonly Pick<CheckDeclaration, 'name'>[], reads: ReadCache): string[] {
    const shipped = [...listChecksById(readManifests(reads).values()).keys()];
    const authored = checks.map((check) => check.name);
    return [...new Set([...shipped, ...authored])];
}

/**
 * Read the shipped naming settings once for a run.
 * @param reads the run cache
 * @returns the shipped naming choices
 */
function readNamingDefaults(reads: ReadCache): NamingDefaults {
    return getCachedValue(reads, NAMING_DEFAULTS);
}

/**
 * List the files in the rules folder of a configuration.
 * @param manifest the configuration.
 * @returns each file with its path inside the rules folder.
 */
function listRuleFiles(manifest: Manifest): ShippedRule[] {
    const { group, name } = manifest.configuration;
    const sources = listAssets(`${manifest.folder}/${RULES_FOLDER}/`);
    return sources.map((source) => ({
        source,
        group,
        path: `${group}/${name}/${posix.relative(manifest.folder + '/' + RULES_FOLDER, source)}`,
    }));
}

/**
 * Index the declared checks by ID, with the configuration of each.
 * @param manifests the configurations to index.
 * @returns the declared checks by ID.
 */
function listChecksById(manifests: Iterable<Manifest>): Map<string, ConfigurationCheck> {
    const checks = new Map<string, ConfigurationCheck>();
    for (const manifest of manifests) {
        for (const check of manifest.checks) {
            checks.set(check.name, { check, configuration: manifest });
        }
    }
    return checks;
}

/**
 * Index the tool declarations by name, and refuse two declarations of one tool.
 * @param manifests the parsed configuration declarations.
 * @returns the tools by name.
 */
function listDeclaredTools(manifests: Iterable<ManifestDeclaration>): Map<string, ToolDeclaration> {
    const tools = new Map<string, ToolDeclaration>();
    for (const manifest of manifests)
        for (const tool of manifest.tools.filter((entry) => typeof entry !== 'string')) {
            const previous = tools.get(tool.name);
            if (previous !== undefined && previous !== tool)
                throw buildManifestError(manifest.configuration.name, [`tool ${tool.name} is already declared.`]);
            tools.set(tool.name, tool);
        }
    return tools;
}

/**
 * Name an unknown check, and suggest close check IDs.
 * @param name the requested check ID.
 * @param known the check IDs to suggest from.
 * @returns the error message.
 */
function formatUnknownCheck(name: string, known: string[]): string {
    const suggestions = selectSimilarNames(name, known);
    return `There is no check called \`${name}\`.${suggestions.length > 0 ? ' Did you mean ' + formatCodeList(suggestions) + '?' : ''}`;
}

export { listCheckIds, readManifests, listRuleFiles, listChecksById, readNamingDefaults, formatUnknownCheck };
