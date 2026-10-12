import { posix } from 'node:path';
import { listAssets } from '#cli/system/assets.ts';
import { knownSettings } from '#cli/settings/view.ts';
import { isBelowFloor } from '#cli/tools/versions.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/built-in.ts';
import type { CheckContradiction } from './types/manifests.ts';
import type { SettingDeclaration } from '#cli/types/settings/tables.ts';
import { allChecks, declaredTools, manifestError } from '#cli/configurations/manifests.ts';
import type { Manifest, PinRequirement, ToolDeclaration, CheckDeclaration } from '#cli/types/configurations.ts';

import {
    RULES_FOLDER,
    EACH_PLACEHOLDER,
    ROOT_PLACEHOLDER,
    FILES_PLACEHOLDER,
    LEVEL_PLACEHOLDER,
    SETTING_PLACEHOLDER,
} from '#cli/config/configurations.ts';

const CHECK_CONTRADICTIONS: CheckContradiction[] = [
    {
        applies: (check) =>
            [...(check.command ?? []), ...(check.fix ?? [])].some((argument) =>
                argument.replaceAll(LEVEL_PLACEHOLDER, '').includes('{level:'),
            ),
        error: (check) => `check ${check.name} must write level choices as {level:<recommended>:<all>}.`,
    },
    {
        applies: (check) => {
            if (check.run_in_copy !== true) return false;
            const perFile = check.runs === 'files' && check.command?.includes(FILES_PLACEHOLDER) === true;
            const perScope =
                check.runs === 'scope' &&
                check.command?.some((argument) => argument.includes(ROOT_PLACEHOLDER)) === true;
            return !perFile && !perScope;
        },
        error: (check) =>
            `check ${check.name} isolates files and requires runs = "files" with {files} or runs = "scope" with {root}.`,
    },
    {
        applies: (check) => check.needs !== undefined && check.stage === 'commit',
        error: (check) =>
            `check ${check.name} needs ${check.needs?.join(', ') ?? ''} and cannot run at the commit stage.`,
    },
];

// Refuses a manifest that requires a configuration no manifest declares.
function assertRequirementsExist(manifest: Manifest, manifests: Map<string, Manifest>): void {
    for (const required of manifest.configuration.requires)
        if (!manifests.has(required))
            throw manifestError(manifest.configuration.name, [`it requires \`${required}\`, which does not exist.`]);
}

// Reject defaults with names absent from the setting declarations.
function assertDefaultsDeclared(manifest: Manifest, settings: Map<string, SettingDeclaration>): void {
    for (const name of Object.keys(manifest.defaults))
        if (!settings.has(name))
            throw manifestError(manifest.configuration.name, [`Defaults name ${name}, which no setting declares.`]);
}

// Refuses a requirement chain that returns to a configuration it already passed.
function assertNoRequirementCycle(manifest: Manifest, manifests: Map<string, Manifest>, chain: string[] = []): void {
    const name = manifest.configuration.name;
    if (chain.includes(name))
        throw manifestError(name, [`Configuration requirement cycle: ${[...chain, name].join(' -> ')}.`]);
    for (const required of manifest.configuration.requires) {
        const dependency = manifests.get(required);
        if (dependency !== undefined) assertNoRequirementCycle(dependency, manifests, [...chain, name]);
    }
}

// Refuses a chain of replacements that returns to a check it already passed.
function assertNoReplacementCycle(
    manifest: Manifest,
    check: CheckDeclaration,
    checks: Map<string, CheckDeclaration>,
): void {
    const chain = [check.name];
    for (let next = check.instead_of; next !== undefined; next = checks.get(next)?.instead_of) {
        if (chain.includes(next))
            throw manifestError(manifest.configuration.name, [
                `Check replacement cycle: ${[...chain, next].join(' -> ')}.`,
            ]);
        chain.push(next);
    }
}

// Refuses a replacement target that names the same check or forms a cycle.
function assertReplacement(manifest: Manifest, check: CheckDeclaration, checks: Map<string, CheckDeclaration>): void {
    const target = check.instead_of;
    if (target !== undefined && (!checks.has(target) || target === check.name))
        throw manifestError(manifest.configuration.name, [
            `check ${check.name} instead_of must name a different check; received ${target}.`,
        ]);
    assertNoReplacementCycle(manifest, check, checks);
}

// Shipped configurations must agree on every program and installer package version.
function assertPinsAgree(tool: ToolDeclaration, owner: string, owners: Map<string, PinRequirement>): void {
    const declared = [
        ...(tool.version === undefined ? [] : [[`tool:${tool.name}`, tool.version] as const]),
        ...Object.entries(tool.installers).flatMap(([installer, pin]) =>
            pin.version === undefined ? [] : [[`${installer}:${pin.name}`, pin.version] as const],
        ),
    ];
    for (const [name, version] of declared) {
        const previous = owners.get(name);
        if (previous !== undefined && previous.version !== version)
            throw manifestError(owner, [
                `Tool pin ${name} conflicts: ${previous.owner} requires ${previous.version}; ${owner} requires ${version}.`,
            ]);
        owners.set(name, { version, owner });
    }
}

function assertToolPin(manifest: Manifest, tool: ToolDeclaration): void {
    const isUnpinned =
        tool.version === undefined && Object.values(tool.installers).some((entry) => entry.version === undefined);
    if (isUnpinned && tool.min_version === undefined)
        throw manifestError(manifest.configuration.name, [`tool ${tool.name} has no version and no floor.`]);
    if (isBelowFloor(tool.version, tool.min_version))
        throw manifestError(manifest.configuration.name, [
            `tool ${tool.name} pins ${tool.version ?? ''}, below its floor ${tool.min_version ?? ''}.`,
        ]);
}

// Scalar arguments and repeated flags both read a declared setting.
function settingsRead(check: CheckDeclaration): string[] {
    const parts = [...(check.command ?? []), ...(check.fix ?? [])];
    const names = parts.flatMap((part) => {
        const repeated = EACH_PLACEHOLDER.exec(part)?.groups?.['setting'];
        return repeated === undefined
            ? [...part.matchAll(SETTING_PLACEHOLDER)].map((match) => match.groups?.['name'] ?? '')
            : [repeated];
    });
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
        if (declaration === undefined)
            throw manifestError(manifest.configuration.name, [
                `check ${check.name} reads ${name}, which no configuration declares.`,
            ]);
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
    tools: Map<string, ToolDeclaration>,
    checks: Map<string, CheckDeclaration>,
): void {
    const unknownTools = [
        ...manifest.toolFiles.map((config) => ({
            owner: `config ${config.target}`,
            names: [...config.tool, ...config.required_tools],
        })),
        ...manifest.tools.map((tool) => ({ owner: `tool ${tool.name}`, names: tool.requires ?? [] })),
        ...manifest.checks.map((check) => ({
            owner: `check ${check.name}`,
            names: [...(check.tool === undefined ? [] : [check.tool]), ...(check.other_tools ?? [])],
        })),
    ].flatMap(({ owner, names }) =>
        names.filter((name) => !tools.has(name)).map((name) => `${owner} requires undeclared tool ${name}.`),
    );
    const unknownChecks = manifest.toolFiles.flatMap((config) =>
        config.check
            .filter((name) => !checks.has(name))
            .map((name) => `config ${config.target} requires undeclared check ${name}.`),
    );
    const errors = [...unknownTools, ...unknownChecks];
    if (errors.length > 0) throw manifestError(manifest.configuration.name, errors);
}

// Conditional instructions must name shipped assets before any consumer selects or reads them.
function assertRuleFiles(manifest: Manifest): void {
    const ruleFiles = new Set(listAssets(`${manifest.dir}/${RULES_FOLDER}/`).map((file) => posix.basename(file)));
    const missingRules = Object.keys(manifest.rules).filter((file) => !ruleFiles.has(file));
    if (missingRules.length > 0)
        throw manifestError(
            manifest.configuration.name,
            missingRules.map((file) => `Rule ${file} does not exist in this configuration.`),
        );
}

/**
 * Reject a check without an implementation or with contradictory execution options.
 * @param manifest the shipped configuration.
 * @param check the declared check
 */
function assertCheckDeclaration(manifest: Manifest, check: CheckDeclaration): void {
    if (check.command === undefined && !(check.name in BUILT_IN_CHECKS))
        throw manifestError(manifest.configuration.name, [
            `The check ${check.name} names no command, and gspot has no built-in check by that name.`,
        ]);
    const contradictions = CHECK_CONTRADICTIONS.filter((entry) => entry.applies(check)).map((entry) =>
        entry.error(check),
    );
    if (contradictions.length > 0) throw manifestError(manifest.configuration.name, contradictions);
}

/**
 * Validate the tools, checks, settings, and rule references of one shipped configuration.
 * @param manifest the shipped configuration.
 * @param context the declarations from all configurations.
 * @param context.manifests the configurations by name.
 * @param context.pinOwners the packages and versions already declared.
 * @param context.tools the declared tools by name.
 * @param context.checks the declared checks by name.
 * @param context.settings the declared settings by name.
 */
function assertManifestDeclarations(
    manifest: Manifest,
    context: {
        manifests: Map<string, Manifest>;
        pinOwners: Map<string, PinRequirement>;
        tools: Map<string, ToolDeclaration>;
        checks: Map<string, CheckDeclaration>;
        settings: Map<string, SettingDeclaration>;
    },
): void {
    const { manifests, pinOwners, tools, checks, settings } = context;
    for (const check of manifest.checks) assertCheckDeclaration(manifest, check);
    assertRuleFiles(manifest);
    assertRequirementsExist(manifest, manifests);
    assertNoRequirementCycle(manifest, manifests);
    for (const tool of manifest.tools) assertPinsAgree(tool, manifest.configuration.name, pinOwners);
    assertToolFileConsumers(manifest, tools, checks);
    for (const tool of manifest.tools.filter((entry) => entry.system !== true)) assertToolPin(manifest, tool);
    for (const check of manifest.checks) assertSettingWait(manifest, check, settings);
    assertDefaultsDeclared(manifest, settings);
}

/**
 * Refuses missing requirements, invalid tool pins, undeclared defaults, conflicting settings,
 * invalid check replacements, missing rule assets, and commands that read settings without waiting for them.
 * @param manifests every manifest by name
 */
export function assertManifests(manifests: Map<string, Manifest>): void {
    const entries = [...manifests.values()];
    const pinOwners = new Map<string, PinRequirement>();
    const tools = declaredTools(entries);
    const names = new Set<string>();
    for (const check of entries.flatMap((manifest) => manifest.checks)) {
        if (names.has(check.name)) throw new Error(`Duplicate check identity: ${check.name}`);
        names.add(check.name);
    }
    const ownedChecks = allChecks(entries);
    const checks: Map<string, CheckDeclaration> = new Map([...ownedChecks].map(([name, { check }]) => [name, check]));
    const settings = knownSettings(entries).declarations;
    for (const manifest of entries)
        assertManifestDeclarations(manifest, { manifests, pinOwners, tools, checks, settings });
    for (const manifest of entries) {
        for (const check of manifest.checks) assertReplacement(manifest, check, checks);
    }
}
