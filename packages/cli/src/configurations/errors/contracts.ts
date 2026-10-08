import semver from 'semver';
import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/platform/public.ts';
import type { ToolPin } from '#cli/types/parsers/tool.ts';
import { listAssets } from '#cli/platform/root/public.ts';
import { allChecks } from '#cli/configurations/contracts.ts';
import { SETTING_PLACEHOLDER, SETTING_DEFAULT_FIELDS, CONFIGURATION_RULES_FOLDER } from '#cli/config/configurations.ts';

import type {
    Manifest,
    SettingMeaning,
    CheckDeclaration,
    SettingDeclaration,
    ManifestDeclaration,
} from '#cli/types/configurations.ts';

// Refuses a manifest that requires a configuration no manifest declares.
function assertRequirementsExist(manifest: Manifest, manifests: Map<string, Manifest>): void {
    for (const required of manifest.configuration.requires)
        if (!manifests.has(required))
            throw manifestError(manifest.configuration.name, [`it requires \`${required}\`, which does not exist.`]);
}

// Refuses a default for a setting no configuration declares, or one the configuration declares itself.
function assertDefaultsDeclared(manifest: Manifest, settings: Map<string, SettingDeclaration>): void {
    const own = new Set(manifest.settings.map((declaration) => declaration.name));
    for (const name of [...Object.keys(manifest.set), ...Object.keys(manifest.set_all)]) {
        const declared = settings.has(name);
        if (declared && !own.has(name)) continue;
        const detail = declared ? 'which this configuration declares itself.' : 'a setting no configuration declares.';
        throw manifestError(manifest.configuration.name, [`[defaults] names ${name}, ${detail}`]);
    }
}

// Refuses a setting two configurations declare with different meanings. Only its defaults may differ.
function assertSettingsAgree(manifests: Map<string, Manifest>): void {
    const first = new Map<string, SettingMeaning>();
    for (const manifest of manifests.values())
        for (const declaration of manifest.settings) {
            const meaning = Object.fromEntries(
                Object.entries(declaration).filter(([key]) => !SETTING_DEFAULT_FIELDS.has(key)),
            );
            const seen = first.get(declaration.name);
            if (seen === undefined)
                first.set(declaration.name, { configuration: manifest.configuration.name, meaning });
            else if (!isDeepStrictEqual(seen.meaning, meaning))
                throw manifestError(manifest.configuration.name, [
                    `setting ${declaration.name} differs from its declaration in ${seen.configuration}.`,
                ]);
        }
}

// Refuses a chain of replacements that returns to a check it already passed.
function assertNoReplacementCycle(
    manifest: Manifest,
    check: CheckDeclaration,
    checks: Map<string, CheckDeclaration>,
): void {
    const chain = [check.name];
    for (let next = check.replaces; next !== undefined; next = checks.get(next)?.replaces) {
        if (chain.includes(next))
            throw manifestError(manifest.configuration.name, [
                `Check replacement cycle: ${[...chain, next].join(' -> ')}.`,
            ]);
        chain.push(next);
    }
}

// Refuses a replacement target that is not a different check, or that forms a cycle.
function assertReplacement(manifest: Manifest, check: CheckDeclaration, checks: Map<string, CheckDeclaration>): void {
    const target = check.replaces;
    if (target !== undefined && (!checks.has(target) || target === check.name))
        throw manifestError(manifest.configuration.name, [
            `check ${check.name} replaces must name a different check; received ${target}.`,
        ]);
    assertNoReplacementCycle(manifest, check, checks);
}

// Whether a pinned version sits below the floor the manifest names, comparing the versions both can coerce.
function isBelowFloor(tool: ToolPin): boolean {
    const pinned = semver.coerce(tool.version);
    const floor = semver.coerce(tool.min_version);
    return pinned !== null && floor !== null && semver.lt(pinned, floor);
}

function assertToolPin(manifest: Manifest, tool: ToolPin): void {
    const isUnpinned =
        tool.version === undefined && Object.values(tool.installers).some((entry) => entry.version === undefined);
    if (isUnpinned && tool.min_version === undefined)
        throw manifestError(manifest.configuration.name, [`tool ${tool.name} has no version and no floor.`]);
    if (isBelowFloor(tool))
        throw manifestError(manifest.configuration.name, [
            `tool ${tool.name} pins ${tool.version ?? ''}, below its floor ${tool.min_version ?? ''}.`,
        ]);
}

// The settings a check's commands read through `{setting:...}` placeholders.
function settingsRead(check: CheckDeclaration): string[] {
    const parts = [...(check.command ?? []), ...(check.fix ?? [])];
    const names = parts.flatMap((part) =>
        [...part.matchAll(SETTING_PLACEHOLDER)].map((match) => match.groups?.['name'] ?? ''),
    );
    return [...new Set(names)];
}

// Refuses a check that reads a setting with an empty default without waiting for it, or waits for a setting nobody declares.
function assertSettingWait(
    manifest: Manifest,
    check: CheckDeclaration,
    settings: Map<string, SettingDeclaration>,
): void {
    const awaited = check.when?.setting;
    if (awaited !== undefined && !settings.has(awaited))
        throw manifestError(manifest.configuration.name, [
            `check ${check.name} waits for ${awaited}, which no configuration declares.`,
        ]);
    const missing = settingsRead(check).filter((name) => {
        if (name === awaited) return false;
        const declaration = settings.get(name);
        if (declaration === undefined) return false;
        const value = declaration.default;
        return value === undefined || value === '' || value === false || (Array.isArray(value) && value.length === 0);
    });
    if (missing.length > 0)
        throw manifestError(
            manifest.configuration.name,
            missing.map((name) => `check ${check.name} reads ${name}, whose default is empty, and must wait for it.`),
        );
}

// Generated consumers and native version prerequisites must resolve to declared registry tools and checks.
function assertToolFileConsumers(
    manifest: Manifest,
    tools: Map<string, ToolPin>,
    checks: Map<string, CheckDeclaration>,
): void {
    const unknownTools = manifest.toolFiles.flatMap((config) =>
        [...config.tool, ...config.required_tools]
            .filter((name) => !tools.has(name))
            .map((name) => `config ${config.target} requires undeclared tool ${name}.`),
    );
    const unknownChecks = manifest.toolFiles.flatMap((config) =>
        config.check
            .filter((name) => !checks.has(name))
            .map((name) => `config ${config.target} requires undeclared check ${name}.`),
    );
    const versionErrors = manifest.checks.flatMap((check) => {
        const required = new Set([check.tool ?? check.command?.[0], ...(check.other_tools ?? [])]);
        return (check.min_versions === undefined ? [] : Object.keys(check.min_versions)).flatMap((name) => {
            if (!required.has(name))
                return [`check ${check.name} sets a version floor for ${name}, which it does not use.`];
            const pin = manifest.tools.find((tool) => tool.name === name) ?? tools.get(name);
            if (pin === undefined) return [`check ${check.name} sets a version floor for undeclared tool ${name}.`];
            if (pin.system === true && pin.version_command === undefined)
                return [`check ${check.name} requires a version command for host tool ${name}.`];
            return [];
        });
    });
    const errors = [...unknownTools, ...unknownChecks, ...versionErrors];
    if (errors.length > 0) throw manifestError(manifest.configuration.name, errors);
}

// Conditional instructions must name shipped assets before any consumer selects or reads them.
function assertRuleFiles(manifest: Manifest): void {
    const ruleFiles = new Set(listAssets(`${manifest.dir}/${CONFIGURATION_RULES_FOLDER}/`));
    const missingRules = Object.keys(manifest.agent_rules).filter(
        (file) => !ruleFiles.has(`${manifest.dir}/${CONFIGURATION_RULES_FOLDER}/${file}`),
    );
    if (missingRules.length > 0)
        throw manifestError(
            manifest.configuration.name,
            missingRules.map((file) => `Rule ${file} does not exist in this configuration.`),
        );
}

/**
 * The error of a configuration manifest that is not valid.
 * @param configuration the configuration name
 * @param errors the errors in plain English
 * @returns the error to throw
 */
export function manifestError(configuration: string, errors: string[]): GspotError {
    return new GspotError('manifest', [`The configuration manifest for \`${configuration}\` is not valid:`, ...errors]);
}

/**
 * Indexes complete tool declarations and refuses independent declarations of the same tool.
 * @param manifests the parsed or resolved configuration declarations
 * @returns the canonical tools by name
 */
export function declaredTools(manifests: Iterable<ManifestDeclaration>): Map<string, ToolPin> {
    const tools = new Map<string, ToolPin>();
    for (const manifest of manifests)
        for (const tool of manifest.tools.filter((entry) => typeof entry !== 'string')) {
            const previous = tools.get(tool.name);
            if (previous !== undefined && previous !== tool)
                throw manifestError(manifest.configuration.name, [`tool ${tool.name} is already declared.`]);
            tools.set(tool.name, tool);
        }
    return tools;
}

/**
 * Refuses missing requirements, invalid tool pins, undeclared defaults, conflicting settings,
 * invalid check replacements, missing rule assets, and commands that read settings without waiting for them.
 * @param manifests every manifest by name
 */
export function assertManifests(manifests: Map<string, Manifest>): void {
    const entries = [...manifests.values()];
    const tools = declaredTools(entries);
    const ownedChecks = allChecks(entries);
    const checks: Map<string, CheckDeclaration> = new Map([...ownedChecks].map(([name, { check }]) => [name, check]));
    const settings: Map<string, SettingDeclaration> = new Map(
        entries.flatMap((manifest) => manifest.settings.map((declaration) => [declaration.name, declaration] as const)),
    );
    assertSettingsAgree(manifests);
    for (const manifest of entries) {
        assertRuleFiles(manifest);
        assertRequirementsExist(manifest, manifests);
        assertToolFileConsumers(manifest, tools, checks);
        for (const tool of manifest.tools.filter((entry) => entry.system !== true)) assertToolPin(manifest, tool);
        for (const check of manifest.checks) assertSettingWait(manifest, check, settings);
        assertDefaultsDeclared(manifest, settings);
    }
    for (const manifest of entries) {
        for (const check of manifest.checks) assertReplacement(manifest, check, checks);
    }
}
