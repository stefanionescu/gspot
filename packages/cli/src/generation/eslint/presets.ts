import { isDeepStrictEqual } from 'node:util';
import { readAsset } from '#cli/platform/assets.ts';
import { npmPins } from '#cli/configurations/pins.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { EslintPresets, EslintRuleNames } from '#cli/types/parsers/eslint.ts';
import { eslintPresetsSchema, eslintRuleNamesSchema } from '#cli/parsers/schema/eslint.ts';
import { ESLINT_PRESET_SOURCES, ESLINT_RULE_NAMES_FILE } from '#cli/config/generation/eslint.ts';

/**
 * Read the exact pinned presets shipped beside their configuration.
 * @param manifest the configuration owning the preset
 * @returns preset blocks without executable plugin or parser objects
 */
export function readEslintPresets(manifest: Manifest): EslintPresets {
    return eslintPresetsSchema.parse(JSON.parse(readAsset(`${manifest.dir}/eslint-presets.json`)));
}

/**
 * Read actual core rule names without loading an installed ESLint runtime.
 * @returns the pinned catalog used by raw-ID explanations and build validation
 */
export function readEslintRuleNames(): EslintRuleNames {
    return eslintRuleNamesSchema.parse(JSON.parse(readAsset(ESLINT_RULE_NAMES_FILE)));
}

/**
 * Reject presets whose package, pin, or preset source does not match the shipped manifests.
 * @param manifests every shipped configuration
 */
export function validateEslintPresets(manifests: Map<string, Manifest>): void {
    const versions = npmPins([...manifests.values()], undefined);
    const presets = readEslintRuleNames();
    if (presets.version !== versions['eslint'])
        throw new Error(`Refresh the core rule names: the catalog must use eslint@${String(versions['eslint'])}.`);
    const presetsByName = new Map(
        Object.entries(ESLINT_PRESET_SOURCES).map(([configuration, sources]) => {
            const manifest = manifests.get(configuration);
            if (manifest === undefined) throw new Error(`No configuration owns the ${configuration} ESLint presets.`);
            const presets = readEslintPresets(manifest);
            const expected = Object.keys(sources).toSorted((left, right) => left.localeCompare(right));
            const installed = Object.keys(presets).toSorted((left, right) => left.localeCompare(right));
            if (!isDeepStrictEqual(installed, expected))
                throw new Error(`Refresh the ${configuration} ESLint presets: the source exports changed.`);
            return [configuration, presets] as const;
        }),
    );
    const declared = Object.entries(ESLINT_PRESET_SOURCES).flatMap(([configuration, sources]) =>
        Object.entries(sources).map(([name, [packageName, source]]) => ({ configuration, name, packageName, source })),
    );
    for (const { configuration, name, packageName, source } of declared) {
        const preset = presetsByName.get(configuration)?.[name];
        const version = versions[packageName];
        const identity =
            preset === undefined
                ? undefined
                : { package: preset.package, source: preset.source, version: preset.version };
        if (!isDeepStrictEqual(identity, { package: packageName, source, version }))
            throw new Error(
                `Refresh ${configuration}/${name}: its ESLint preset must use ${packageName}@${String(version)}.`,
            );
    }
}
