// Bun copies pinned linter rule lists into packages/cli/configurations after a linter version changes.
import { z } from 'zod';
import { join, dirname } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { assetPath } from '#cli/system/assets.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import type { SchemaShape } from '#cli/types/objects.ts';
import type { StylelintModule } from './types/rule-lists.ts';
import { toolProjectPins } from '#cli/configurations/tool-pins.ts';
import type { EslintPresets } from '#cli/types/generation/eslint.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { PackageJson } from '#cli/types/parsers/dependency-files.ts';
import { eslintPresetSchema } from '#cli/configurations/schema/manifest.ts';
import { ruleNamesFileSchema } from '#cli/generation/tool-file-sources/stylelint.ts';
import { ESLINT_PRESETS_FILE, BUILTIN_RULES_SOURCE } from '#cli/config/generation/eslint.ts';
import { STYLELINT_RULES_SOURCE, STYLELINT_RULE_NAMES_FILE } from '#cli/config/generation/tool-file-sources.ts';

import {
    JSON_INDENT,
    BUN_INSTALL,
    TESTS_FOLDER,
    ESLINT_PACKAGE,
    STYLELINT_PACKAGE,
    PACKAGE_JSON_FILE,
    STYLE_SAMPLE_FILE,
    PRESET_BLOCK_KEYS,
    PRETTIER_JSON_PARSER,
    ESLINT_RULE_NAMES_FILE,
    ESLINT_RULE_NAMES_MODULE,
    ESLINT_RUNTIME_NAMES_FILE,
    ESLINT_RUNTIME_NAMES_MODULE,
    STYLELINT_RULE_NAMES_MODULE,
} from './config/rule-lists.ts';

const stylelintConfigSchema = z.object({ rules: z.record(z.string(), z.unknown()) } satisfies SchemaShape<{
    rules: Record<string, unknown>;
}>);

/** The installed public function the explicit maintenance command invokes. */
const stylelintModuleSchema = z.object({
    default: z.custom<StylelintModule>(
        (value) =>
            value !== null &&
            (typeof value === 'function' || typeof value === 'object') &&
            typeof Reflect.get(value, 'resolveConfig') === 'function',
    ),
} satisfies SchemaShape<{ default: StylelintModule }>);

const eslintRuleModuleSchema = z.object({ builtinRules: z.map(z.string(), z.unknown()) } satisfies SchemaShape<{
    builtinRules: Map<string, unknown>;
}>);
const eslintModuleSchema = z.object({ default: z.unknown() } satisfies SchemaShape<{ default: unknown }>);
const eslintGlobalsSchema = z.object({
    default: z.record(z.string(), z.record(z.string(), z.boolean())),
} satisfies SchemaShape<{ default: Record<string, Record<string, boolean>> }>);
/**
 * Capture the actual public preset export before discarding executable plugin objects.
 * @param packageName the owning npm package.
 * @param version the installed package version.
 * @param source the dotted public export path, with slashes retained inside keys.
 * @param module the package's default export.
 * @returns validated rule and file data from every ordered preset block.
 */
function captureEslintPreset(
    packageName: string,
    version: string,
    source: string,
    module: unknown,
): EslintPresets[string] {
    let value = module;
    for (const key of source === '' ? [] : source.split('.')) {
        if (typeof value !== 'object' || value === null)
            throw new Error(`${packageName} has no preset export ${source}.`);
        value = Reflect.get(value, key);
    }
    const blocks = (Array.isArray(value) ? value : [value]).map((block: unknown) => {
        if (typeof block !== 'object' || block === null)
            throw new Error(`${packageName} preset ${source} must contain configuration objects.`);
        const language: unknown = Reflect.get(block, 'languageOptions');
        const payload = Object.fromEntries(
            PRESET_BLOCK_KEYS.flatMap((key) =>
                Reflect.get(block, key) === undefined ? [] : [[key, Reflect.get(block, key)]],
            ),
        );
        return {
            ...payload,
            parser: typeof language === 'object' && language !== null && Reflect.get(language, 'parser') !== undefined,
        };
    });
    return eslintPresetSchema.parse({ package: packageName, version, source, blocks });
}
const npmPackageIdentitySchema = z.object({ name: z.string(), version: z.string() } satisfies SchemaShape<
    Required<Pick<PackageJson, 'name' | 'version'>>
>);

/**
 * Read an installed package's identity from its resolved public entry.
 * @param packageName the expected package
 * @param module the public package entry to resolve
 * @returns the package name and version
 */
function installedAtPin(packageName: string, module = packageName): { name: string; version: string; entry: string } {
    const entry = Bun.resolveSync(module, testsFolder);
    const document = installedPackageIdentity(entry, packageName);
    if (document.version !== versions[packageName])
        throw new Error(`Install ${packageName}@${String(versions[packageName])} first.`);
    return { ...document, entry };
}

/**
 * Find the package identity above one resolved public entry.
 * @returns the declared package identity
 * @param entry the resolved public package file
 * @param packageName the expected owning package
 */
function installedPackageIdentity(entry: string, packageName: string): { name: string; version: string } {
    for (let folder = dirname(entry); folder !== dirname(folder); folder = dirname(folder)) {
        let text: string;
        try {
            text = readFileSync(join(folder, PACKAGE_JSON_FILE), 'utf8');
        } catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
            continue;
        }
        const document = npmPackageIdentitySchema.parse(JSON.parse(text));
        if (document.name === packageName) return document;
    }
    throw new Error(`No installed package named ${packageName} owns ${entry}.`);
}

const testsFolder = fileURLToPath(new URL(`../${TESTS_FOLDER}/`, import.meta.url));
const manifests = configurationManifests();
const versions = toolProjectPins([...manifests.values()]).npm;
const testsPackagePath = join(testsFolder, PACKAGE_JSON_FILE);
const testsPackage = z
    .object({ devDependencies: z.record(z.string(), z.string()) })
    .loose()
    .parse(JSON.parse(readFileSync(testsPackagePath, 'utf8')));
const updatedTestsPackage = {
    ...testsPackage,
    devDependencies: {
        ...testsPackage.devDependencies,
        ...Object.fromEntries(
            Object.entries(versions).filter(([name]) => Object.hasOwn(testsPackage.devDependencies, name)),
        ),
    },
};
const packageFormatting = await resolveConfig(testsPackagePath);
writeFileSync(
    testsPackagePath,
    await format(JSON.stringify(updatedTestsPackage), { ...packageFormatting, parser: PRETTIER_JSON_PARSER }),
);
const installed = Bun.spawn([...BUN_INSTALL], { cwd: dirname(testsFolder), stdout: 'inherit', stderr: 'inherit' });
const installExit = await installed.exited;
if (installExit !== 0) throw new Error(`Bun install exited ${String(installExit)}. Rule lists were not refreshed.`);
const prepared = new Map<string, unknown>();
const eslintPackage = installedAtPin(ESLINT_PACKAGE, ESLINT_RULE_NAMES_MODULE);
const builtinExports: unknown = await import(pathToFileURL(eslintPackage.entry).href);
const eslint = eslintRuleModuleSchema.parse(builtinExports);
const ruleNames = ruleNamesFileSchema.parse({
    package: eslintPackage.name,
    version: eslintPackage.version,
    source: BUILTIN_RULES_SOURCE,
    rules: [...eslint.builtinRules.keys()].toSorted((first, second) => first.localeCompare(second)),
});
prepared.set(assetPath(ESLINT_RULE_NAMES_FILE), ruleNames);
for (const manifest of [...manifests.values()].filter((entry) => Object.keys(entry.eslint.presets).length > 0)) {
    const presetsByName = Object.fromEntries(
        await Promise.all(
            Object.entries(manifest.eslint.presets).map(async ([name, { package: packageName, source }]) => {
                const installed = installedAtPin(packageName);
                const exported: unknown = await import(pathToFileURL(installed.entry).href);
                const { default: module } = eslintModuleSchema.parse(exported);
                return [name, captureEslintPreset(packageName, installed.version, source, module)] as const;
            }),
        ),
    );
    const presetsPath = assetPath(`${manifest.dir}/${ESLINT_PRESETS_FILE}`);
    prepared.set(presetsPath, presetsByName);
}
const installedGlobals = installedAtPin(ESLINT_RUNTIME_NAMES_MODULE);
const exportedGlobals: unknown = await import(pathToFileURL(installedGlobals.entry).href);
const globals = eslintGlobalsSchema.parse(exportedGlobals).default;
prepared.set(
    assetPath(ESLINT_RUNTIME_NAMES_FILE),
    Object.keys(globals).toSorted((first, second) => first.localeCompare(second)),
);
const standard = installedAtPin(STYLELINT_RULE_NAMES_MODULE);
const installedStylelint = installedAtPin(STYLELINT_PACKAGE);
const exportedStylelint: unknown = await import(pathToFileURL(installedStylelint.entry).href);
const { default: stylelint } = stylelintModuleSchema.parse(exportedStylelint);
const style = stylelintConfigSchema.parse(
    await stylelint.resolveConfig(join(testsFolder, STYLE_SAMPLE_FILE), {
        config: { extends: standard.entry },
    }),
);
prepared.set(
    assetPath(STYLELINT_RULE_NAMES_FILE),
    ruleNamesFileSchema.parse({
        package: standard.name,
        version: standard.version,
        source: STYLELINT_RULES_SOURCE,
        rules: Object.keys(style.rules).toSorted((first, second) => first.localeCompare(second)),
    }),
);
for (const [path, value] of prepared) {
    const settings = await resolveConfig(path);
    const text = await format(JSON.stringify(value), {
        ...settings,
        parser: PRETTIER_JSON_PARSER,
        tabWidth: JSON_INDENT,
    });
    writeFileSync(path, text);
}
console.log(`Refreshed ${String(prepared.size)} rule-list data files.`);
