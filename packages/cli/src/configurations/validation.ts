import semver from 'semver';
import { posix } from 'node:path';
import { readFileSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { SETTING_PLACEHOLDER } from '#cli/config/placeholders.ts';
import { listAssets, buildAssetPath } from '#cli/system/assets.ts';
import { nameListSchema } from '#cli/schemas/configurations/name-lists.ts';
import { EACH_PLACEHOLDER } from '#cli/config/runs/command/placeholders.ts';
import type { SettingDefinition } from '#cli/types/settings/definitions.ts';
import { eslintPresetsSchema } from '#cli/schemas/configurations/eslint-presets.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import type { Tool, Check, NameList, Configuration } from '#cli/types/configurations.ts';
import { ESLINT_PRESETS_FILE } from '#cli/config/generation/configurations/language/javascript/eslint/presets.ts';

function validateReferences(configuration: Configuration, tools: Set<string>, checks: Set<string>): string[] {
    const names = [
        ...configuration.configFiles.flatMap((file) => file.tool),
        ...configuration.eslint.required_tools,
        ...configuration.tools.flatMap((tool) => tool.requires ?? []),
        ...configuration.checks.flatMap((check) => [
            ...(check.tool === undefined ? [] : [check.tool]),
            ...(check.other_tools ?? []),
        ]),
    ];
    const rules = new Set(listAssets(`${configuration.folder}/rules/`).map((path) => posix.basename(path)));
    return [
        ...names.filter((name) => !tools.has(name)).map((name) => `tool ${name} has no declaration.`),
        ...configuration.configFiles.flatMap((file) =>
            file.check.filter((name) => !checks.has(name)).map((name) => `check ${name} has no declaration.`),
        ),
        ...Object.keys(configuration.rules)
            .filter((name) => !rules.has(name))
            .map((name) => `conditional rule ${name} has no shipped rule file.`),
    ];
}

function hasEmptyDefault(declaration: SettingDefinition | undefined, value: unknown): boolean {
    if (declaration === undefined) return true;
    const defaultValue = declaration.default_all ?? declaration.default;
    const selected = value ?? defaultValue;
    return (
        selected === undefined ||
        selected === '' ||
        selected === false ||
        (Array.isArray(selected) && selected.length === 0)
    );
}

function validateCheckSettings(check: Check, defaults: Record<string, unknown>): string[] {
    const declarations: Readonly<Record<string, SettingDefinition>> = SETTING_DEFINITIONS;
    const awaited = check.when?.setting;
    const names = [...(check.command ?? []), ...(check.fix ?? [])].flatMap((argument) => {
        const repeated = EACH_PLACEHOLDER.exec(argument)?.groups?.['setting'];
        return repeated === undefined
            ? argument
                  .matchAll(SETTING_PLACEHOLDER)
                  .map((match) => match.groups?.['name'] ?? '')
                  .toArray()
            : repeated;
    });
    return [
        ...(awaited !== undefined && declarations[awaited] === undefined
            ? [`${check.id} waits for undeclared setting ${awaited}.`]
            : []),
        ...names
            .filter((name) => name !== awaited && hasEmptyDefault(declarations[name], defaults[name]))
            .map((name) => `${check.id} uses empty-default setting ${name} without when.setting.`),
    ];
}

function validateToolPin(tool: Tool): string[] {
    const version = semver.coerce(tool.version);
    const minimum = semver.coerce(tool.min_version);
    const isOutdated = version !== null && minimum !== null && semver.lt(version, minimum);
    const isUnpinned = tool.system !== true && tool.version === undefined && tool.min_version === undefined;
    return [
        ...(isOutdated
            ? [`tool ${tool.name} pins ${String(tool.version)} below its minimum ${String(tool.min_version)}.`]
            : []),
        ...Object.values(tool.installers)
            .filter((pin) => isUnpinned && pin.version === undefined)
            .map(() => `tool ${tool.name} has no version pin or minimum.`),
    ];
}

function validateInstallerVersions(tools: Tool[], versions: Map<string, string>): string[] {
    const pins = tools.flatMap((tool) => Object.entries(tool.installers));
    const errors: string[] = [];
    for (const [installer, pin] of pins) {
        if (pin.version === undefined) continue;
        const key = `${installer}:${pin.name}`;
        const previous = versions.get(key);
        versions.set(key, pin.version);
        if (previous !== undefined && previous !== pin.version)
            errors.push(`${key} has conflicting versions ${previous} and ${pin.version}.`);
    }
    return errors;
}

function validateSnapshots(configuration: Configuration, versions: Map<string, string>): string[] {
    const paths = listAssets(`${configuration.folder}/`);
    const snapshots: Pick<NameList, 'package' | 'version'>[] = [];
    for (const path of paths) {
        if (!path.endsWith('-names.json') && !path.endsWith(`/${ESLINT_PRESETS_FILE}`)) continue;
        const contents = readFileSync(buildAssetPath(path), 'utf8');
        const parsed: unknown = JSON.parse(contents);
        if (path.endsWith('-names.json')) snapshots.push(nameListSchema.parse(parsed));
        else snapshots.push(...Object.values(eslintPresetsSchema.parse(parsed)));
    }
    return snapshots
        .filter((snapshot) => versions.get(`npm:${snapshot.package}`) !== snapshot.version)
        .map((snapshot) => `${snapshot.package} snapshot version ${snapshot.version} does not match its npm pin.`);
}

/**
Refuse shipped manifests whose references, version pins, or check conditions cannot work.

@param configurations the resolved configuration manifests.
*/
export function validateConfigurations(configurations: Map<string, Configuration>): void {
    const rows = configurations.values().toArray();
    const tools = new Set(rows.flatMap((configuration) => configuration.tools.map(({ name }) => name)));
    const checks = new Set(rows.flatMap((configuration) => configuration.checks.map(({ id }) => id)));
    const versions = new Map<string, string>();
    const defaults = Object.fromEntries(rows.flatMap((configuration) => Object.entries(configuration.defaults)));
    const checked = rows.map((configuration) => ({
        configuration,
        errors: [
            ...configuration.tools.flatMap((tool) => validateToolPin(tool)),
            ...validateInstallerVersions(configuration.tools, versions),
        ],
    }));
    for (const { configuration, errors } of checked) {
        const failures = [
            ...errors,
            ...validateReferences(configuration, tools, checks),
            ...validateSnapshots(configuration, versions),
            ...Object.keys(configuration.defaults)
                .filter((name) => !Object.hasOwn(SETTING_DEFINITIONS, name))
                .map((name) => `default ${name} has no setting declaration.`),
            ...configuration.checks.flatMap((check) => [
                ...validateCheckSettings(check, defaults),
                ...(check.needs !== undefined && check.stage === 'commit'
                    ? [`${check.id} needs resources unavailable at the commit stage.`]
                    : []),
            ]),
        ];
        if (failures.length > 0) throw buildManifestError(configuration.name, [...new Set(failures)]);
    }
}

/**
Build the error for a manifest that fails validation.

@param configuration the name of the failing manifest.
@param errors the messages in plain English.
@returns the error to throw.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 4 calls in 2 files share it.
export function buildManifestError(configuration: string, errors: string[]): GspotError {
    return new GspotError(
        'configuration',
        [`The configuration manifest for \`${configuration}\` is not valid:`, ...errors].join('\n'),
    );
}
