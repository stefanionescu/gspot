// Explicitly refresh shipped preset data from an already installed tool project.
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { assetPath } from '#cli/platform/assets.ts';
import { npmPins } from '#cli/configurations/pins.ts';
import { JSON_INDENT } from '#cli/config/generation/eta.ts';
import { readInstalledNpmPackage } from '#automation/parsers/npm.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { ESLINT_REFRESH_ARGUMENT_COUNT } from '#automation/config/eslint-presets.ts';

import {
    ESLINT_PRESET_SOURCES,
    ESLINT_RULE_NAMES_FILE,
    ESLINT_RULE_NAMES_MODULE,
} from '#cli/config/generation/eslint.ts';
import {
    eslintModuleSchema,
    captureEslintPreset,
    eslintRuleNamesSchema,
    eslintRuleModuleSchema,
} from '#cli/parsers/schema/eslint.ts';

const project = process.argv[2];
if (project === undefined || process.argv.length !== ESLINT_REFRESH_ARGUMENT_COUNT)
    throw new Error('Pass the folder of the installed tool project: bun scripts/eslint-presets.ts .gspot');
const manifests = configurationManifests();
const versions = npmPins([...manifests.values()], undefined);
const prepared = new Map<string, unknown>();
const eslintEntry = Bun.resolveSync(ESLINT_RULE_NAMES_MODULE, join(process.cwd(), project));
const eslintPackage = readInstalledNpmPackage(eslintEntry, 'eslint');
if (eslintPackage.version !== versions['eslint'])
    throw new Error(`The core rule catalog needs eslint@${String(versions['eslint'])}; install that pin first.`);
const coreExports: unknown = await import(pathToFileURL(eslintEntry).href);
const eslint = eslintRuleModuleSchema.parse(coreExports);
const presets = eslintRuleNamesSchema.parse({
    package: eslintPackage.name,
    version: eslintPackage.version,
    source: 'builtinRules',
    rules: [...eslint.builtinRules.keys()].toSorted((first, second) => first.localeCompare(second)),
});
const ruleNamesPath = assetPath(ESLINT_RULE_NAMES_FILE);
prepared.set(ruleNamesPath, presets);
for (const [configuration, sources] of Object.entries(ESLINT_PRESET_SOURCES)) {
    const manifest = manifests.get(configuration);
    if (manifest === undefined) throw new Error(`No configuration owns ${configuration}.`);
    const presetsByName = Object.fromEntries(
        await Promise.all(
            Object.entries(sources).map(async ([name, [packageName, source]]) => {
                const entry = Bun.resolveSync(packageName, join(process.cwd(), project));
                const installed = readInstalledNpmPackage(entry, packageName);
                const version = versions[packageName];
                if (installed.version !== version)
                    throw new Error(
                        `${configuration}/${name} needs ${packageName}@${String(version)}; install that pin first.`,
                    );
                const exported: unknown = await import(pathToFileURL(entry).href);
                const { default: module } = eslintModuleSchema.parse(exported);
                return [name, captureEslintPreset(packageName, installed.version, source, module)] as const;
            }),
        ),
    );
    const presetsPath = assetPath(`${manifest.dir}/eslint-presets.json`);
    prepared.set(presetsPath, presetsByName);
}
for (const [path, value] of prepared) await writeFormattedJson(path, value);
console.log(`Refreshed ${String(prepared.size)} ESLint data files.`);

// Write each validated data file with the repository's JSON formatting.
async function writeFormattedJson(path: string, value: unknown): Promise<void> {
    const settings = await resolveConfig(path);
    const text = await format(JSON.stringify(value), { ...settings, parser: 'json', tabWidth: JSON_INDENT });
    writeFileSync(path, text);
}
