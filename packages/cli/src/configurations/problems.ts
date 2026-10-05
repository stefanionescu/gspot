// What makes a manifest invalid: a check that contradicts itself, a configuration nothing reads, or references
// between manifests that do not hold.
import semver from 'semver';
import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/platform/errors.ts';
import { listAssets } from '#cli/platform/assets.ts';
import { similar, codeList } from '#cli/platform/text.ts';
import { allChecks, configurationName } from '#cli/configurations/declarations.ts';
import { CONFIG_PLACEHOLDER, SETTING_PLACEHOLDER } from '#cli/config/parsers/command.ts';
import { SETTING_DEFAULT_FIELDS, CONFIGURATION_RULES_FOLDER } from '#cli/config/configurations.ts';

import type {
    ToolPin,
    Manifest,
    RawCheck,
    CheckRule,
    CheckSpec,
    OwnedCheck,
    RawManifest,
    SettingSpec,
    SettingMeaning,
    UnknownConfiguration,
    ConfigurationDeclaration,
} from '#cli/types/configurations.ts';

// Each way a check declaration contradicts itself, with the sentence that reports it.
const CHECK_RULES: CheckRule[] = [
    {
        applies: (check) => check.nested_config_file !== undefined && check.cwd !== 'scope',
        problem: (check) => `check ${check.name} discovers nested configuration and requires cwd = scope.`,
    },
    {
        applies: (check) =>
            check.path_prefix !== undefined && (check.runs !== 'files' || check.command?.includes('{files}') !== true),
        problem: (check) =>
            `check ${check.name} prefixes file arguments and requires runs = "files" with {files} in its command.`,
    },
    {
        applies: (check) => {
            if (check.run_in_copy !== true) return false;
            const perFile = check.runs === 'files' && check.command?.includes('{files}') === true;
            const perScope = check.runs === 'scope' && check.command?.includes('{root}') === true;
            return !perFile && !perScope;
        },
        problem: (check) =>
            `check ${check.name} isolates files and requires runs = "files" with {files} or runs = "scope" with {root}.`,
    },
    {
        applies: (check) => check.needs !== undefined && check.stage === 'commit',
        problem: (check) =>
            `check ${check.name} needs ${check.needs?.join(', ') ?? ''} and cannot run at the commit stage.`,
    },
    {
        applies: (check) =>
            check.stage === 'manual' &&
            check.needs === undefined &&
            check.runs === 'files' &&
            check.command === undefined,
        problem: (check) => `check ${check.name} is manual with nothing that makes it slow.`,
    },
];

function configurationReaders(checks: RawCheck[]): Set<string> {
    const readers = new Set<string>();
    for (const check of checks)
        for (const argument of [...(check.command ?? []), ...(check.fix ?? []), ...Object.values(check.env ?? {})])
            for (const match of argument.matchAll(CONFIG_PLACEHOLDER)) readers.add(match[1] ?? '');
    return readers;
}

// Refuses a manifest that requires a configuration no manifest declares.
function assertRequirementsExist(manifest: Manifest, manifests: Map<string, Manifest>): void {
    for (const required of manifest.configuration.requires)
        if (!manifests.has(required))
            throw manifestError(manifest.configuration.name, [`it requires \`${required}\`, which does not exist.`]);
}

// Whether a check is built in, runs once per repository, and names no command or tool.
function isStandalone(check: CheckSpec | undefined): boolean {
    if (check === undefined) return false;
    return check.command === undefined && check.tool === undefined && check.runs === 'once';
}

// Refuses a check reference that does not name another configuration's standalone built-in check.
function assertReferences(manifest: Manifest, checks: Map<string, OwnedCheck>): void {
    for (const reference of manifest.configuration.borrowed_checks) {
        const owner = checks.get(reference);
        if (
            owner === undefined ||
            owner.configuration.configuration.name === manifest.configuration.name ||
            !isStandalone(owner.check)
        )
            throw manifestError(manifest.configuration.name, [
                `Referenced check ${reference} must name another configuration's standalone built-in check that runs once.`,
            ]);
    }
}

// Refuses a default for a setting no configuration declares, or one the configuration declares itself.
function assertDefaultsDeclared(manifest: Manifest, settings: Map<string, SettingSpec>): void {
    const own = new Set(manifest.settings.map((spec) => spec.name));
    for (const name of [...Object.keys(manifest.set), ...Object.keys(manifest.set_all)]) {
        if (!settings.has(name))
            throw manifestError(manifest.configuration.name, [
                `[defaults] names ${name}, a setting no configuration declares.`,
            ]);
        if (own.has(name))
            throw manifestError(manifest.configuration.name, [
                `[defaults] names ${name}, which this configuration declares itself.`,
            ]);
    }
}

// Refuses a setting two configurations declare with different meanings. Only its defaults may differ.
function assertSettingsAgree(manifests: Map<string, Manifest>): void {
    const first = new Map<string, SettingMeaning>();
    for (const manifest of manifests.values())
        for (const spec of manifest.settings) {
            const meaning = Object.fromEntries(
                Object.entries(spec).filter(([key]) => !SETTING_DEFAULT_FIELDS.has(key)),
            );
            const seen = first.get(spec.name);
            if (seen === undefined) first.set(spec.name, { configuration: manifest.configuration.name, meaning });
            else if (!isDeepStrictEqual(seen.meaning, meaning))
                throw manifestError(manifest.configuration.name, [
                    `setting ${spec.name} differs from its declaration in ${seen.configuration}.`,
                ]);
        }
}

// Refuses a chain of replacements that returns to a check it already passed.
function assertNoReplacementCycle(manifest: Manifest, check: CheckSpec, checks: Map<string, CheckSpec>): void {
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
function assertReplacement(manifest: Manifest, check: CheckSpec, checks: Map<string, CheckSpec>): void {
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
function settingsRead(check: CheckSpec): string[] {
    const parts = [...(check.command ?? []), ...(check.fix ?? [])];
    const names = parts.flatMap((part) =>
        [...part.matchAll(SETTING_PLACEHOLDER)].map((match) => match.groups?.['name'] ?? ''),
    );
    return [...new Set(names)];
}

// Refuses a check that reads a setting with an empty default without waiting for it, or waits for a setting nobody declares.
function assertSettingWait(manifest: Manifest, check: CheckSpec, settings: Map<string, SettingSpec>): void {
    const awaited = check.when?.setting;
    if (awaited !== undefined && !settings.has(awaited))
        throw manifestError(manifest.configuration.name, [
            `check ${check.name} waits for ${awaited}, which no configuration declares.`,
        ]);
    const missing = settingsRead(check).filter((name) => {
        if (name === awaited) return false;
        const spec = settings.get(name);
        if (spec === undefined) return false;
        const value = spec.default;
        return value === undefined || value === '' || value === false || (Array.isArray(value) && value.length === 0);
    });
    if (missing.length > 0)
        throw manifestError(
            manifest.configuration.name,
            missing.map((name) => `check ${check.name} reads ${name}, whose default is empty, and must wait for it.`),
        );
}

// Generated consumers and native version prerequisites must resolve to declared registry tools and checks.
function assertConfigurationConsumers(
    manifest: Manifest,
    tools: Map<string, ToolPin>,
    checks: Map<string, CheckSpec>,
): void {
    const unknownTools = manifest.configs.flatMap((config) =>
        config.tool
            .filter((name) => !tools.has(name))
            .map((name) => `config ${config.target} requires undeclared tool ${name}.`),
    );
    const unknownChecks = manifest.configs.flatMap((config) =>
        config.check
            .filter((name) => !checks.has(name))
            .map((name) => `config ${config.target} requires undeclared check ${name}.`),
    );
    const versionProblems = manifest.checks.flatMap((check) => {
        const required = new Set([check.tool ?? check.command?.[0], ...(check.other_tools ?? [])]);
        return Object.keys(check.min_versions ?? {}).flatMap((name) => {
            if (!required.has(name))
                return [`check ${check.name} sets a version floor for ${name}, which it does not use.`];
            const pin = manifest.tools.find((tool) => tool.name === name) ?? tools.get(name);
            if (pin === undefined) return [`check ${check.name} sets a version floor for undeclared tool ${name}.`];
            if (pin.system === true && pin.version_command === undefined)
                return [`check ${check.name} requires a version command for host tool ${name}.`];
            return [];
        });
    });
    const problems = [...unknownTools, ...unknownChecks, ...versionProblems];
    if (problems.length > 0) throw manifestError(manifest.configuration.name, problems);
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
 * @param problems the problems in plain English
 * @returns the error to throw
 */
export function manifestError(configuration: string, problems: string[]): GspotError {
    return new GspotError('manifest', [
        `The configuration manifest for \`${configuration}\` is not valid:`,
        ...problems,
    ]);
}

/**
 * Contradictory check declarations and generated configurations with no reader or pointer.
 * @param raw the parsed manifest
 * @returns contradictory declarations and config files without a declared reader
 */
export function manifestProblems(raw: RawManifest): string[] {
    const checks = raw.checks.flatMap((check) =>
        CHECK_RULES.filter((rule) => rule.applies(check)).map((rule) => rule.problem(check)),
    );
    const fragments = raw.configs.flatMap((config) => [
        ...(config.imports !== undefined && !config.fragment
            ? [`config ${config.target} declares imports, which only a fragment renders.`]
            : []),
        ...(!config.fragment && (config.component_globs.length > 0 || config.selectors.length > 0)
            ? [`config ${config.target} declares code files or selectors, which only a fragment adds.`]
            : []),
    ]);
    const references = raw.checks.some((check) => raw.configuration.borrowed_checks.includes(check.name))
        ? ['A configuration cannot both declare and reference the same check.']
        : [];
    const declarations = [...checks, ...fragments, ...references];
    const readers = configurationReaders(raw.checks);
    const hasBuiltInCheck = raw.checks.some((check) => check.command === undefined);
    // Built-in checks read assets in source; command placeholders cannot prove which configs they use.
    if (hasBuiltInCheck) return declarations;
    // A config that needs another configuration is read by that configuration's check, as Semgrep reads every pack in its folder.
    const configurations = raw.configs
        .filter((config) => !config.fragment && config.stub_file === undefined && config.when === undefined)
        .filter((config) => {
            const name = configurationName(config.target);
            const isReadByTemplate = raw.configs.some(
                (other) => other !== config && other.template?.includes(name) === true,
            );
            return !readers.has(name) && !isReadByTemplate;
        })
        .map(
            (config) =>
                `config ${config.target} has no check that reads it ({config:${configurationName(config.target)}}) and no pointer.`,
        );
    return [...declarations, ...configurations];
}

/**
 * Refuses missing requirements, invalid tool pins, undeclared defaults, conflicting settings,
 * invalid check replacements, missing rule assets, and commands that read settings without waiting for them.
 * @param manifests every manifest by name
 */
export function assertManifests(manifests: Map<string, Manifest>): void {
    const tools = new Map(
        [...manifests.values()].flatMap((manifest) => manifest.tools.map((tool) => [tool.name, tool] as const)),
    );
    const ownedChecks = allChecks(manifests.values());
    const checks: Map<string, CheckSpec> = new Map([...ownedChecks].map(([name, { check }]) => [name, check]));
    const settings: Map<string, SettingSpec> = new Map(
        [...manifests.values()].flatMap((manifest) => manifest.settings.map((spec) => [spec.name, spec] as const)),
    );
    assertSettingsAgree(manifests);
    for (const manifest of manifests.values()) {
        assertRuleFiles(manifest);
        assertRequirementsExist(manifest, manifests);
        assertConfigurationConsumers(manifest, tools, checks);
        for (const tool of manifest.tools.filter((entry) => entry.system !== true)) assertToolPin(manifest, tool);
        for (const check of manifest.checks) assertSettingWait(manifest, check, settings);
        assertDefaultsDeclared(manifest, settings);
    }
    for (const manifest of manifests.values()) {
        assertReferences(manifest, ownedChecks);
        for (const check of manifest.checks) assertReplacement(manifest, check, checks);
    }
}

/**
 * Names an unavailable configuration and suggests nearby declared names.
 * @param name the requested configuration
 * @param known the declared configuration names
 * @returns the public diagnostic
 */
export function unknownConfigurationDiagnostic(name: string, known: string[]): string {
    const suggestions = similar(name, known);
    return `There is no configuration called \`${name}\`.${suggestions.length > 0 ? ' Did you mean ' + codeList(suggestions) + '?' : ''} Run \`gspot list configurations\` to see the available configurations.`;
}

/**
 * Reports unknown configuration names without losing their declaration order or location.
 * @param declarations the requested names, with their original fields
 * @param manifests the declared configurations
 * @returns each unknown declaration with its public diagnostic
 */
export function unknownConfigurations<Declaration extends Pick<ConfigurationDeclaration, 'name'>>(
    declarations: readonly Declaration[],
    manifests: ReadonlyMap<string, Manifest>,
): UnknownConfiguration<Declaration>[] {
    const known = [...manifests.keys()];
    return declarations
        .filter(({ name }) => !manifests.has(name))
        .map((declaration) => ({
            ...declaration,
            message: unknownConfigurationDiagnostic(declaration.name, known),
        }));
}
