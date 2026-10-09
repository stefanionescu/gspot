import type { z } from 'zod';
import { posix } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { GspotError } from '#cli/platform/public.ts';
import { compact, isRecord } from '#cli/platform/contracts.ts';
import type { NamingTerms } from '#cli/types/parsers/naming.ts';
import { shippedNamingSchema } from '#cli/parsers/schema/naming.ts';
import { readAsset, listAssets } from '#cli/platform/root/public.ts';
import { manifestSchema } from '#cli/parsers/schema/configurations.ts';
import { declaredTools, manifestError } from '#cli/configurations/errors/contracts.ts';
import { pinOf, allChecks, collectPins, toolProjectPackage } from '#cli/configurations/contracts.ts';
import { manifestErrors, unknownConfigurationDiagnostic } from '#cli/configurations/errors/public.ts';
import { CONFIG_PREFIX, NAMING_TERMS_FILE, CONFIGURATION_RULES_FOLDER } from '#cli/config/configurations.ts';

import type {
    MisePin,
    Manifest,
    RuleSource,
    ManifestCache,
    SelectionWalk,
    CheckDeclaration,
    ManifestDeclaration,
    SelectedConfigurations,
} from '#cli/types/configurations.ts';

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

// Selection: the configurations named plus every configuration they require, dependencies first, in order of first mention.

function visit(walk: SelectionWalk, configurationName: string): void {
    if (walk.seen.has(configurationName)) return;
    if (walk.visiting.includes(configurationName)) {
        const chain = [...walk.visiting.slice(walk.visiting.indexOf(configurationName)), configurationName];
        walk.errors.push(
            `The configurations require each other in a circle: ${chain.join(' -> ')}. This is a bug in a configuration manifest.`,
        );
        return;
    }
    const manifest = walk.manifests.get(configurationName);
    if (!manifest) {
        const known = walk.manifests.keys().toArray();
        walk.errors.push(unknownConfigurationDiagnostic(configurationName, known));
        walk.seen.add(configurationName);
        return;
    }
    walk.visiting.push(configurationName);
    for (const required of manifest.configuration.requires) visit(walk, required);
    walk.visiting.pop();
    walk.seen.add(configurationName);
    walk.order.push(manifest);
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
    if (tools.some((tool) => toolProjectPackage(tool)?.kind === 'python') && !tools.some((tool) => tool.name === 'uv'))
        pins.push(pythonInstallerPin());
    return pins;
}

/**
 * The chain of requirements from one configuration to another, without revisiting a declaration.
 * @param target the required configuration.
 * @param from the configuration the chain starts at.
 * @param manifests every configuration manifest.
 * @returns the configuration names along the chain from the starting configuration to the target, or undefined when no chain exists.
 */
export function requireChain(target: string, from: string, manifests: Map<string, Manifest>): string[] | undefined {
    const seen = new Set<string>();
    function search(current: string): string[] | undefined {
        if (current === target) return [current];
        if (seen.has(current)) return undefined;
        seen.add(current);
        for (const required of manifests.get(current)?.configuration.requires ?? []) {
            const rest = search(required);
            if (rest !== undefined) return [current, ...rest];
        }
        return undefined;
    }
    return search(from);
}

/**
 * Resolves configuration names to ordered manifests. Throws GspotError('selection') for unknown configurations or circular requirements.
 * @param configurationNames the requested configuration names.
 * @param manifests every configuration manifest.
 * @returns the manifests, requirements first, in order of first mention.
 */
export function selectConfigurations(configurationNames: string[], manifests: Map<string, Manifest>): Manifest[] {
    const walk: SelectionWalk = { manifests, errors: [], order: [], seen: new Set(), visiting: [] };
    for (const configurationName of configurationNames) visit(walk, configurationName);
    const { errors } = walk;
    if (errors.length > 0) throw new GspotError('selection', [...new Set(errors)]);
    return walk.order;
}

/**
 * Tests whether a configuration owns language or framework source.
 * @param manifest the configuration declaration
 * @returns whether it contributes source to shared checks
 */
export function isSourceKind(manifest: Manifest): boolean {
    return manifest.configuration.kind === 'language' || manifest.configuration.kind === 'framework';
}

/**
 * Language and framework configurations that contribute source to shared checks.
 * @param selected the selected manifests.
 * @returns the source policy owners.
 */
export function sourceConfigurations(selected: Manifest[]): Manifest[] {
    return selected.filter((manifest) => isSourceKind(manifest));
}

/**
 * Every distinct manifest across the scopes, in first-seen order.
 * @param scopes the selected scopes.
 * @returns the manifests.
 */
export function everyManifest(scopes: SelectedConfigurations[]): Manifest[] {
    const seen = new Map<string, Manifest>();
    for (const scope of scopes)
        for (const manifest of scope.selected)
            if (!seen.has(manifest.configuration.name)) seen.set(manifest.configuration.name, manifest);
    return seen.values().toArray();
}

/**
 * Tests whether any resolved scope selects a configuration.
 * @param scopes the validated scope selections
 * @param name the configuration name
 * @returns whether the configuration is selected in at least one scope
 */
export function isConfigurationSelected(scopes: SelectedConfigurations[], name: string): boolean {
    return scopes.some((selection) => selection.selected.some((manifest) => manifest.configuration.name === name));
}
