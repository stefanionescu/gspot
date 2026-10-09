// Explicitly refresh shipped preset data from the installed test packages.
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { assetPath } from '#cli/platform/root/public.ts';
import { JSON_INDENT } from '#cli/config/generation/eta.ts';
import { toolProjectPins } from '#cli/configurations/contracts.ts';
import { readInstalledNpmPackage } from '#automation/parsers/npm.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { STYLELINT_RULE_NAMES_FILE, STYLELINT_RULE_NAMES_MODULE } from '#cli/config/parsers/stylelint.ts';

import {
    stylelintConfigSchema,
    stylelintModuleSchema,
    stylelintRuleNamesSchema,
} from '#cli/parsers/schema/stylelint.ts';
import {
    ESLINT_RULE_NAMES_FILE,
    ESLINT_RULE_NAMES_MODULE,
    ESLINT_RUNTIME_NAMES_FILE,
    ESLINT_RUNTIME_NAMES_MODULE,
} from '#cli/config/generation/eslint.ts';
import {
    eslintModuleSchema,
    captureEslintPreset,
    eslintGlobalsSchema,
    eslintRuleNamesSchema,
    eslintRuleModuleSchema,
} from '#cli/parsers/schema/public.ts';

const project = join(process.cwd(), 'tests');
process.chdir(project);
const manifests = configurationManifests();
const versions = toolProjectPins([...manifests.values()]).npm;
const prepared = new Map<string, unknown>();
const eslintEntry = Bun.resolveSync(ESLINT_RULE_NAMES_MODULE, project);
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
for (const manifest of [...manifests.values()].filter((entry) => Object.keys(entry.eslint_presets).length > 0)) {
    const configuration = manifest.configuration.name;
    const presetsByName = Object.fromEntries(
        await Promise.all(
            Object.entries(manifest.eslint_presets).map(async ([name, { package: packageName, source }]) => {
                const entry = Bun.resolveSync(packageName, project);
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
const globalsEntry = Bun.resolveSync(ESLINT_RUNTIME_NAMES_MODULE, project);
const installedGlobals = readInstalledNpmPackage(globalsEntry, ESLINT_RUNTIME_NAMES_MODULE);
if (installedGlobals.version !== versions[ESLINT_RUNTIME_NAMES_MODULE])
    throw new Error(
        `Runtime capture needs globals@${String(versions[ESLINT_RUNTIME_NAMES_MODULE])}; install that pin first.`,
    );
const exportedGlobals: unknown = await import(pathToFileURL(globalsEntry).href);
const globals = eslintGlobalsSchema.parse(exportedGlobals).default;
prepared.set(
    assetPath(ESLINT_RUNTIME_NAMES_FILE),
    Object.keys(globals)
        .filter((name) => name !== 'serviceworker')
        .concat('service-worker')
        .toSorted((first, second) => first.localeCompare(second)),
);
const standardEntry = Bun.resolveSync(STYLELINT_RULE_NAMES_MODULE, project);
const standard = readInstalledNpmPackage(standardEntry, STYLELINT_RULE_NAMES_MODULE);
const stylelintEntry = Bun.resolveSync('stylelint', project);
const installedStylelint = readInstalledNpmPackage(stylelintEntry, 'stylelint');
if (standard.version !== versions[STYLELINT_RULE_NAMES_MODULE] || installedStylelint.version !== versions['stylelint'])
    throw new Error(
        `Stylesheet rule capture needs the declared Stylelint and standard preset pins; install those pins first.`,
    );
const exportedStylelint: unknown = await import(pathToFileURL(stylelintEntry).href);
const { default: stylelint } = stylelintModuleSchema.parse(exportedStylelint);
const style = stylelintConfigSchema.parse(
    await stylelint.resolveConfig(join(process.cwd(), 'capture.css'), {
        config: { extends: standardEntry },
    }),
);
prepared.set(
    assetPath(STYLELINT_RULE_NAMES_FILE),
    stylelintRuleNamesSchema.parse({
        package: standard.name,
        version: standard.version,
        source: 'resolveConfig.rules',
        rules: Object.keys(style.rules).toSorted((first, second) => first.localeCompare(second)),
    }),
);
for (const [path, value] of prepared) await writeFormattedJson(path, value);
console.log(`Refreshed ${String(prepared.size)} preset data files.`);

// Write each validated data file with the repository's JSON formatting.
async function writeFormattedJson(path: string, value: unknown): Promise<void> {
    const settings = await resolveConfig(path);
    const text = await format(JSON.stringify(value), { ...settings, parser: 'json', tabWidth: JSON_INDENT });
    writeFileSync(path, text);
}
