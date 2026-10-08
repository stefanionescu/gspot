import type { z } from 'zod';
import { posix } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import type { ToolPin } from '#cli/types/parsers/tool.ts';
import { compact, isRecord } from '#cli/platform/contracts.ts';
import type { NamingTerms } from '#cli/types/parsers/naming.ts';
import { hasToolSection } from '#cli/parsers/tool/contracts.ts';
import { shippedNamingSchema } from '#cli/parsers/schema/naming.ts';
import type { PackageManifest } from '#cli/types/parsers/packages.ts';
import { manifestErrors } from '#cli/configurations/errors/public.ts';
import { manifestSchema } from '#cli/parsers/schema/configurations.ts';
import { surveyRepository } from '#cli/repository/discovery/public.ts';
import { readText, readAsset, listAssets } from '#cli/platform/root/public.ts';
import { declaredTools, manifestError } from '#cli/configurations/errors/contracts.ts';
import { isGlob, pathMatcher, isToolProjectPath } from '#cli/repository/paths/public.ts';
import type { Tooling, ToolFile, TrackedFile, FileDeclaration } from '#cli/types/repository/inventory.ts';
import { pinOf, allChecks, pythonPins, collectPins, npmToolNames } from '#cli/configurations/contracts.ts';
import { CONFIG_PREFIX, NAMING_TERMS_FILE, CONFIGURATION_RULES_FOLDER } from '#cli/config/configurations.ts';

import type {
    MisePin,
    Manifest,
    RuleSource,
    ManifestCache,
    CheckDeclaration,
    ManifestDeclaration,
} from '#cli/types/configurations.ts';

function hasSection(root: string, path: string, replace: NonNullable<ToolPin['replace']>[number]): boolean {
    const source = readText(root, path);
    if (source === undefined) return false;
    if (replace.table === undefined && replace.key === undefined) return true;
    return hasToolSection(source, path, replace);
}

// The tool configurations one replace row finds among the tracked files.
function planTakeoverConfigs(
    root: string,
    inventory: Set<string>,
    tool: string,
    replace: NonNullable<ToolPin['replace']>[number],
): ToolFile[] {
    const matches = pathMatcher([replace.file, `**/${replace.file}`]);
    const candidates = new Set(inventory);
    if (!isGlob(replace.file) && !candidates.has(replace.file) && readText(root, replace.file) !== undefined)
        candidates.add(replace.file);
    return [...candidates]
        .filter((candidate) => matches(candidate))
        .filter((path) => hasSection(root, path, replace))
        .map((path) => ({
            tool,
            path,
            shared: replace.shared,
            ...(replace.table === undefined ? {} : { table: replace.table }),
            ...(replace.key === undefined ? {} : { key: replace.key }),
        }));
}

/**
 * Discover configuration sections declared by the tools that own them.
 * @param root the repository root
 * @param paths the tracked file paths
 * @returns tool configurations with their containing files and sections
 */
function getToolConfigs(root: string, paths: Iterable<string>): ToolFile[] {
    const inventory = new Set([...paths].filter((path) => !isToolProjectPath(path)));
    return [...configurationManifests().values()].flatMap((manifest) =>
        manifest.tools.flatMap((tool) =>
            (tool.replace ?? []).flatMap((replace) => planTakeoverConfigs(root, inventory, tool.name, replace)),
        ),
    );
}

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
 * Find the tool configuration the configurations replace, with the hooks, CI, agent files, lint folders, and runner found.
 * @param root the repository root
 * @param files the tracked files
 * @param packageManifests the parsed package manifests
 * @returns the configuration files, hooks, CI, agent files, lint folders, and runner found
 */
export function getTooling(root: string, files: TrackedFile[], packageManifests: PackageManifest[]): Tooling {
    const configurations = getToolConfigs(
        root,
        files.filter((file) => file.kind === 'source').map((file) => file.path),
    );
    return {
        toolFiles: [
            ...new Map(
                configurations.map((entry) => [
                    JSON.stringify([entry.tool, entry.path, entry.table, entry.key]),
                    entry,
                ]),
            ).values(),
        ],
        ...surveyRepository(root, files, packageManifests, npmToolNames(configurationManifests().values())),
    };
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

/**
 * The files of a configuration's rules folder. Each installs under the configuration's category and name, as language/bash/BASH.md.
 * @param manifest the configuration
 * @returns each file with its path inside the rules folder
 */
export function configurationFiles(manifest: Manifest): RuleSource[] {
    const { kind, name } = manifest.configuration;
    const sources = listAssets(`${manifest.dir}/${CONFIGURATION_RULES_FOLDER}/`);
    return sources.map((source) => ({
        source,
        path: `${kind}/${name}/${posix.relative(manifest.dir + '/' + CONFIGURATION_RULES_FOLDER, source)}`,
    }));
}

/**
 * Resolve authored declarations and generated paths of the configurations each scope selects.
 * @param declarations the authored file declarations
 * @param selected the actual manifests selected by each authored scope
 * @returns file declarations with internal configuration origins retained
 */
export function fileDeclarations(
    declarations: FileDeclaration[],
    selected: Map<string, Manifest[]>,
): FileDeclaration[] {
    return [
        ...declarations.filter((entry) => entry.kind !== 'generated' || entry.configuration === undefined),
        ...selected.entries().flatMap(([path, manifests]) =>
            manifests.flatMap(({ generated, configuration }) =>
                generated.length === 0
                    ? []
                    : [
                          {
                              kind: 'generated' as const,
                              configuration: configuration.name,
                              paths: generated.map((file) => posix.join(path, file)),
                          },
                      ],
            ),
        ),
    ];
}

/**
 * The bundled Python bootstrap pin, including its required installer version.
 * @returns the declared uv mise pin
 */
export function pythonInstallerPin(): MisePin {
    const tool = configurationManifests()
        .get('python')
        ?.tools.find((entry) => entry.name === 'uv');
    const pin = tool === undefined ? undefined : pinOf(tool);
    if (pin === undefined) throw manifestError('python', ['tool uv requires a pinned mise installer version.']);
    return pin;
}

/**
 * Select tools that mise installs. Omit tools in npm and Python tool projects.
 * @param manifests the selected manifests.
 * @returns pins installed by mise.
 */
export function misePins(manifests: Manifest[]): MisePin[] {
    const tools = collectPins(manifests);
    const pins = tools.flatMap((tool) => pinOf(tool) ?? []);
    if (pythonPins(manifests).length > 0 && !tools.some((tool) => tool.name === 'uv')) pins.push(pythonInstallerPin());
    return pins;
}
