// Load the built-in configuration registry and resolve its references once per process.
import type { z } from 'zod';
import { posix } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { compact, isRecord } from '#cli/platform/objects.ts';
import type { NamingTerms } from '#cli/types/parsers/naming.ts';
import { allChecks } from '#cli/configurations/declarations.ts';
import { readAsset, listAssets } from '#cli/platform/assets.ts';
import { shippedNamingSchema } from '#cli/parsers/schema/naming.ts';
import { manifestSchema } from '#cli/parsers/schema/configurations/manifest.ts';
import { CONFIG_PREFIX, NAMING_TERMS_FILE } from '#cli/config/configurations.ts';
import { declaredTools, manifestError, manifestErrors } from '#cli/configurations/errors.ts';
import type { Manifest, ManifestCache, CheckDeclaration, ManifestDeclaration } from '#cli/types/configurations.ts';

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

// The [configuration] table with the name and the kind its folder gives, as configurations/general/docs gives docs and general.
function locatedConfiguration(configuration: unknown, dir: string): Record<string, unknown> {
    const declared = isRecord(configuration) ? configuration : {};
    if ('name' in declared || 'kind' in declared)
        throw manifestError(posix.basename(dir), [
            '[configuration] declares a name or a kind, which its folder already gives.',
        ]);
    return { ...declared, name: posix.basename(dir), kind: posix.basename(posix.dirname(dir)) };
}

const state: ManifestCache = { cache: undefined };
let shipped: NamingTerms | undefined;

// Parses one embedded manifest and registers it under its folder name.
function registerManifest(manifests: Map<string, ManifestDeclaration>, path: string): void {
    const dir = path.slice(0, -'/manifest.toml'.length);
    const manifest = parseManifest(readAsset(path), dir);
    if (manifests.has(manifest.configuration.name))
        throw manifestError(manifest.configuration.name, ['The configuration name is already registered.']);
    manifests.set(manifest.configuration.name, manifest);
}

/**
 * Parse one manifest text into validated declarations; invalid input throws GspotError with code manifest.
 * @param text the manifest.toml text
 * @param dir the configuration folder inside the assets, such as configurations/general/docs, which gives the configuration its name and kind
 * @returns the manifest
 */
export function parseManifest(text: string, dir: string): ManifestDeclaration {
    const parsed = parseToml(text);
    const rules = listAssets(`${dir}/semgrep/`)
        .filter((path) => path.endsWith('.yml.eta'))
        .map((path) => {
            const source = posix.relative(dir, path);
            return {
                source,
                target: CONFIG_PREFIX + source.slice(0, -'.eta'.length),
                tool: 'semgrep',
                rule_keys: ['rules'],
                per_scope: true,
                when: { configuration: 'security' },
            };
        });
    const source = 'eslint.fragment.js.eta';
    const fragments = listAssets(`${dir}/`)
        .filter((path) => path === `${dir}/${source}`)
        .map(() => ({ source, target: `${CONFIG_PREFIX}eslint.config.mjs`, tool: 'eslint', fragment: true }));
    let toolFiles = parsed['tool_file'];
    if (toolFiles === undefined) toolFiles = [...rules, ...fragments];
    else if (Array.isArray(toolFiles)) {
        const declared = new Set(toolFiles.flatMap((file) => (isRecord(file) ? [file['source']] : [])));
        toolFiles = [
            ...toolFiles.map((file) =>
                isRecord(file) && file['source'] === source ? { ...fragments[0], ...file } : file,
            ),
            ...rules,
            ...fragments.filter((fragment) => !declared.has(fragment.source)),
        ];
    }
    const result = manifestSchema.safeParse({
        ...parsed,
        tool_file: toolFiles,
        configuration: locatedConfiguration(parsed['configuration'], dir),
    });
    if (!result.success)
        throw manifestError(posix.basename(dir), [
            ...new Set(result.error.issues.flatMap((issue) => issueLines(issue))),
        ]);
    const declared = result.data;
    // A check's ID is the configuration's name, a slash, and the check's own name.
    const raw = {
        ...declared,
        checks: declared.checks.map((check) => ({ ...check, name: `${declared.configuration.name}/${check.name}` })),
    };
    const errors = manifestErrors(raw, text);
    if (errors.length > 0) throw manifestError(raw.configuration.name, errors);
    return {
        ...raw,
        checks: raw.checks.map((check) => compact(check)),
        settings: raw.settings.map((setting) => compact(setting)),
        dir,
    };
}

/**
 * Resolves each named tool to its complete declaration without changing configuration selection.
 * @param manifests the parsed configuration declarations
 * @returns the registry with canonical tool metadata
 */
export function linkManifestTools(manifests: ManifestDeclaration[]): Map<string, Manifest> {
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
 * Every embedded manifest by configuration name. Read once per process.
 * @returns the manifests
 */
export function configurationManifests(): Map<string, Manifest> {
    if (state.cache) return state.cache;
    const manifests = new Map<string, ManifestDeclaration>();
    // The checks across manifests run at build time and in the tests, not on every start.
    for (const path of listAssets('configurations/'))
        if (path.endsWith('/manifest.toml')) registerManifest(manifests, path);
    state.cache = linkManifestTools(
        [...manifests.values()].toSorted((first, second) =>
            first.configuration.name.localeCompare(second.configuration.name),
        ),
    );
    return state.cache;
}

/**
 * Lists built-in check IDs alongside the repository's command check IDs.
 * @param checks the command checks declared by this repository
 * @returns the available check IDs
 */
export function knownChecks(checks: readonly Pick<CheckDeclaration, 'name'>[]): string[] {
    const bundled = [...allChecks(configurationManifests().values()).keys()];
    const authored = checks.map((check) => check.name);
    return [...new Set([...bundled, ...authored])];
}

/**
 * Reads the bundled naming policy once for policy validation and source checks.
 * @returns the shipped naming choices
 */
export function namingTerms(): NamingTerms {
    shipped ??= shippedNamingSchema.parse(JSON.parse(readAsset(NAMING_TERMS_FILE)));
    return shipped;
}
