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

// Producer identities retain bundled declarations only for the supplied run cache.
const MANIFESTS = { create: readBundledManifests };

const NAMING_DEFAULTS = { create: readBundledNamingDefaults };

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
 * Resolves each named tool to its complete declaration without changing configuration selection.
 * @param manifests the parsed configuration declarations
 * @returns the registry with canonical tool metadata
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
 * @param configurationFolder the asset folder that determines the configuration name and group.
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
    // A check's ID joins the configuration name and its own name.
    return {
        ...declared,
        checks: declared.checks.map((check) =>
            stripUndefined({ ...check, name: `${declared.configuration.name}/${check.name}` }),
        ),
        folder: configurationFolder,
    };
}

// Parse shipped declarations only for the first manifest read in one run.
function readBundledManifests(): Map<string, Manifest> {
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

function readBundledNamingDefaults(): NamingDefaults {
    return namingDefaultsSchema.parse(JSON.parse(readAsset(NAMING_DEFAULTS_FILE)));
}

/**
 * The error for an invalid configuration manifest.
 * @param configuration the configuration name
 * @param errors the errors in plain English
 * @returns the error to throw
 */
function buildManifestError(configuration: string, errors: string[]): GspotError {
    return new GspotError(
        'manifest',
        [`The configuration manifest for \`${configuration}\` is not valid:`, ...errors].join('\n'),
    );
}

/**
 * Every configuration manifest by configuration name, retained only for the supplied run.
 * @param reads the run cache
 * @returns the run-cached declarations indexed by configuration name.
 */
function readManifests(reads: ReadCache): Map<string, Manifest> {
    return getCachedValue(reads, MANIFESTS);
}

/**
 * Lists built-in check IDs alongside the repository's command check IDs.
 * @param checks the command checks declared by this repository
 * @param reads the run cache
 * @returns the available check IDs
 */
function listCheckIds(checks: readonly Pick<CheckDeclaration, 'name'>[], reads: ReadCache): string[] {
    const bundled = [...listChecksById(readManifests(reads).values()).keys()];
    const authored = checks.map((check) => check.name);
    return [...new Set([...bundled, ...authored])];
}

/**
 * Reads bundled naming settings, retaining them for the supplied run.
 * @param reads the run cache
 * @returns the shipped naming choices
 */
function readNamingDefaults(reads: ReadCache): NamingDefaults {
    return getCachedValue(reads, NAMING_DEFAULTS);
}

/**
 * Lists the files in a configuration's rules folder.
 * @param manifest the configuration
 * @returns each file with its path inside the rules folder
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
 * Every declared check by ID, with the configuration that ships it.
 * @param manifests the manifests to index
 * @returns the declared checks by ID
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
 * Indexes complete tool declarations and refuses independent declarations of the same tool.
 * @param manifests the parsed configuration declarations
 * @returns the canonical tools by name
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
 * Name an unknown check and suggest nearby checks from the caller's inventory.
 * @param name the requested check ID
 * @param known the check IDs available to the caller
 * @returns the shared selection diagnostic
 */
function formatUnknownCheck(name: string, known: string[]): string {
    const suggestions = selectSimilarNames(name, known);
    return `There is no check called \`${name}\`.${suggestions.length > 0 ? ' Did you mean ' + formatCodeList(suggestions) + '?' : ''}`;
}

export { listCheckIds, readManifests, listRuleFiles, listChecksById, readNamingDefaults, formatUnknownCheck };
