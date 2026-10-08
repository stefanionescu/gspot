import { isDeepStrictEqual } from 'node:util';
import { readAsset } from '#cli/platform/assets.ts';
import { npmPins } from '#cli/configurations/pins.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { ESLINT_RULE_NAMES_FILE } from '#cli/config/generation/eslint.ts';
import type { EslintPresets, EslintRuleNames } from '#cli/types/parsers/eslint.ts';
import { eslintPresetsSchema, eslintRuleNamesSchema } from '#cli/parsers/schema/eslint.ts';

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
    for (const manifest of [...manifests.values()].filter((entry) => Object.keys(entry.eslint_presets).length > 0)) {
        const configuration = manifest.configuration.name;
        const sources = manifest.eslint_presets;
        const presets = readEslintPresets(manifest);
        if (!isDeepStrictEqual(new Set(Object.keys(presets)), new Set(Object.keys(sources))))
            throw new Error(`Refresh the ${configuration} ESLint presets: the source exports changed.`);
        const invalid = Object.entries(sources).find(([name, { package: packageName, source }]) => {
            const preset = presets[name];
            return !isDeepStrictEqual(
                { package: preset?.package, source: preset?.source, version: preset?.version },
                { package: packageName, source, version: versions[packageName] },
            );
        });
        if (invalid !== undefined) {
            const [name, { package: packageName }] = invalid;
            throw new Error(
                `Refresh ${configuration}/${name}: its ESLint preset must use ${packageName}@${String(versions[packageName])}.`,
            );
        }
    }
}
