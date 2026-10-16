import { z } from 'zod';
import { posix } from 'node:path';
import { GspotError } from '#cli/errors.ts';
import { parse as parseToml } from 'smol-toml';
import { memo } from '#cli/system/file-reads.ts';
import { compact, isRecord } from '#cli/objects.ts';
import type { RuleSource } from '#cli/types/rules.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { readAsset, listAssets } from '#cli/system/assets.ts';
import { TOOL_FILE_PREFIX } from '#cli/config/system/locations.ts';
import { type NamingDefaults } from '#cli/types/checks/general.ts';
import { manifestSchema } from '#cli/configurations/schema/manifest.ts';
import { namingDefaultsSchema } from '#cli/configurations/schema/naming.ts';

import type {
    Manifest,
    ToolDeclaration,
    CheckDeclaration,
    ConfigurationCheck,
    ManifestDeclaration,
} from '#cli/types/configurations.ts';
import {
    RULES_FOLDER,
    MANIFEST_FILE,
    SEMGREP_FOLDER,
    SEMGREP_TOOL_FILE,
    TOOL_VERSIONS_FILE,
    NAMING_DEFAULTS_FILE,
    CONFIGURATIONS_FOLDER,
} from '#cli/config/configurations.ts';

function issueLines(issue: z.core.$ZodIssue): string[] {
    const line = `${issue.path.map(String).join('.')}: ${issue.message}`;
    return issue.code === 'invalid_union'
        ? [
              line,
              ...issue.errors.flatMap((branch) =>
                  branch.flatMap((nested) => issueLines({ ...nested, path: [...issue.path, ...nested.path] })),
              ),
          ]
        : [line];
}

// Producer identities retain bundled declarations only for the supplied run cache.
const MANIFESTS = { create: configurationManifests };
const NAMING_DEFAULTS = { create: namingDefaults };

// Discovery adds plain Semgrep and Vale assets while retaining invalid declarations for schema errors.
function discoveredToolFilesAt(dir: string, toolFiles: unknown): unknown {
    const declaredSources = new Set(
        Array.isArray(toolFiles) ? toolFiles.flatMap((entry) => (isRecord(entry) ? [entry['source']] : [])) : [],
    );
    const rules = listAssets(`${dir}/${SEMGREP_FOLDER}`)
        .filter((path) => path.endsWith('.yml') && !declaredSources.has(posix.relative(dir, path)))
        .map((path) => ({
            source: posix.relative(dir, path),
            target: TOOL_FILE_PREFIX + posix.relative(dir, path),
            ...SEMGREP_TOOL_FILE,
        }));
    const valeFiles = listAssets(`${dir}/vale/`).map((path) => ({
        source: posix.relative(dir, path),
        target: TOOL_FILE_PREFIX + 'vale/' + posix.relative(dir + '/vale', path),
        tool: 'vale',
    }));
    const discovered = [...rules, ...valeFiles];
    if (toolFiles === undefined) return discovered;
    if (!Array.isArray(toolFiles)) return toolFiles;
    const declarations: unknown[] = toolFiles;
    return [...declarations, ...discovered];
}

// The shared build supplies versions once for declarations and their installers.
function applyToolVersions(manifest: ManifestDeclaration, versions: Record<string, string>): void {
    for (const tool of manifest.tools) {
        if (typeof tool === 'string') continue;
        const version = versions[tool.name];
        if (version === undefined) continue;
        tool.version = version;
        for (const installer of Object.values(tool.installers)) installer.version ??= version;
    }
}

/**
 * Resolves each named tool to its complete declaration without changing configuration selection.
 * @param manifests the parsed configuration declarations
 * @returns the registry with canonical tool metadata
 */
function linkManifestTools(manifests: ManifestDeclaration[]): Map<string, Manifest> {
    const tools = declaredTools(manifests);
    return new Map(
        manifests.map((manifest) => [
            manifest.configuration.name,
            {
                ...manifest,
                tools: manifest.tools.map((tool) => {
                    if (typeof tool !== 'string') return tool;
                    const declared = tools.get(tool);
                    if (declared === undefined)
                        throw manifestError(manifest.configuration.name, [`tool ${tool} has no declaration.`]);
                    return declared;
                }),
            },
        ]),
    );
}

/**
 * Parse one manifest text into validated declarations; invalid input throws GspotError with code manifest.
 * @param text the manifest.toml text
 * @param dir the configuration folder inside the assets, such as configurations/general/docs, which gives the configuration its name and group
 * @returns the manifest
 */
function parseManifest(text: string, dir: string): ManifestDeclaration {
    const parsed = parseToml(text);
    const toolFiles = parsed['tool_file'];
    const discoveredToolFiles = discoveredToolFilesAt(dir, toolFiles);
    const result = manifestSchema.safeParse({
        ...parsed,
        tool_file: discoveredToolFiles,
        configuration: {
            ...(isRecord(parsed['configuration']) ? parsed['configuration'] : {}),
            name: posix.basename(dir),
            group: posix.basename(posix.dirname(dir)),
        },
    });
    if (!result.success)
        throw manifestError(posix.basename(dir), [
            ...new Set(result.error.issues.flatMap((issue) => issueLines(issue))),
        ]);
    const declared = result.data;
    // A check's ID joins the configuration name and its own name.
    return {
        ...declared,
        checks: declared.checks.map((check) =>
            compact({ ...check, name: `${declared.configuration.name}/${check.name}` }),
        ),
        dir,
    };
}

/**
 * Every configuration manifest by configuration name, retained only for the supplied run.
 * @param reads the optional run cache
 * @returns the manifests
 */
function configurationManifests(reads?: ReadCache): Map<string, Manifest> {
    if (reads !== undefined) return memo(reads, MANIFESTS);
    const manifests = new Map<string, ManifestDeclaration>();
    const toolVersions = (z.record(z.string(), z.string().min(1)) satisfies z.ZodType<Record<string, string>>).parse(
        JSON.parse(readAsset(TOOL_VERSIONS_FILE)),
    );
    // The checks across manifests run at build time and in the tests, not on every start.
    const paths = listAssets(`${CONFIGURATIONS_FOLDER}/`).filter((path) => path.endsWith(`/${MANIFEST_FILE}`));
    for (const path of paths) {
        const dir = path.slice(0, -`/${MANIFEST_FILE}`.length);
        const manifest = parseManifest(readAsset(path), dir);
        applyToolVersions(manifest, toolVersions);
        manifests.set(manifest.configuration.name, manifest);
    }
    return linkManifestTools(
        [...manifests.values()].toSorted((first, second) =>
            first.configuration.name.localeCompare(second.configuration.name),
        ),
    );
}

/**
 * Lists built-in check IDs alongside the repository's command check IDs.
 * @param checks the command checks declared by this repository
 * @param reads the optional run cache
 * @returns the available check IDs
 */
function knownChecks(checks: readonly Pick<CheckDeclaration, 'name'>[], reads?: ReadCache): string[] {
    const bundled = [...allChecks(configurationManifests(reads).values()).keys()];
    const authored = checks.map((check) => check.name);
    return [...new Set([...bundled, ...authored])];
}

/**
 * Reads bundled naming settings, retaining them for the supplied run.
 * @param reads the optional run cache
 * @returns the shipped naming choices
 */
function namingDefaults(reads?: ReadCache): NamingDefaults {
    if (reads !== undefined) return memo(reads, NAMING_DEFAULTS);
    return namingDefaultsSchema.parse(JSON.parse(readAsset(NAMING_DEFAULTS_FILE)));
}

/**
 * Lists the files in a configuration's rules folder.
 * @param manifest the configuration
 * @returns each file with its path inside the rules folder
 */
function ruleFiles(manifest: Manifest): RuleSource[] {
    const { group, name } = manifest.configuration;
    const sources = listAssets(`${manifest.dir}/${RULES_FOLDER}/`);
    return sources.map((source) => ({
        source,
        group,
        path: `${group}/${name}/${posix.relative(manifest.dir + '/' + RULES_FOLDER, source)}`,
    }));
}

/**
 * Every declared check by ID, with the configuration that ships it.
 * @param manifests the manifests to index
 * @returns the declared checks by ID
 */
function allChecks(manifests: Iterable<Manifest>): Map<string, ConfigurationCheck> {
    const checks = new Map<string, ConfigurationCheck>();
    for (const manifest of manifests) {
        for (const check of manifest.checks) {
            checks.set(check.name, { check, configuration: manifest });
        }
    }
    return checks;
}

/**
 * The name a tool-file placeholder uses for a tool file.
 * @param target the target path
 * @returns the file name under .gspot/config without its extensions
 */
function toolFileName(target: string): string {
    const bare = target.startsWith(TOOL_FILE_PREFIX) ? target.slice(TOOL_FILE_PREFIX.length) : target;
    const dot = bare.indexOf('.');
    return dot === -1 ? bare : bare.slice(0, dot);
}

/**
 * The error for an invalid configuration manifest.
 * @param configuration the configuration name
 * @param errors the errors in plain English
 * @returns the error to throw
 */
function manifestError(configuration: string, errors: string[]): GspotError {
    return new GspotError(
        'manifest',
        [`The configuration manifest for \`${configuration}\` is not valid:`, ...errors].join('\n'),
    );
}

/**
 * Indexes complete tool declarations and refuses independent declarations of the same tool.
 * @param manifests the parsed configuration declarations
 * @returns the canonical tools by name
 */
function declaredTools(manifests: Iterable<ManifestDeclaration>): Map<string, ToolDeclaration> {
    const tools = new Map<string, ToolDeclaration>();
    for (const manifest of manifests)
        for (const tool of manifest.tools.filter((entry) => typeof entry !== 'string')) {
            const previous = tools.get(tool.name);
            if (previous !== undefined && previous !== tool)
                throw manifestError(manifest.configuration.name, [`tool ${tool.name} is already declared.`]);
            tools.set(tool.name, tool);
        }
    return tools;
}

export {
    ruleFiles,
    allChecks,
    knownChecks,
    toolFileName,
    manifestError,
    declaredTools,
    namingDefaults,
    configurationManifests,
};
