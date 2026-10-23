// Bun installs the pinned linter packages in a temporary folder and copies their rule names, global names, and presets
// into packages/cli/configurations.
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { isTable } from '#cli/system/tables.ts';
import { JSON_INDENT } from '#cli/config/text.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnProcess } from '#cli/system/processes.ts';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import { listAssets, buildAssetPath } from '#cli/system/assets.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { nameListSchema } from '#cli/schemas/configurations/name-lists.ts';
import { eslintPresetSchema } from '#cli/schemas/configurations/eslint-presets.ts';
import type { EslintPreset, EslintPresets } from '#cli/types/generation/eslint.ts';
import type { PackageIdentity, InstalledPackage } from '#cli/types/linter-lists.ts';
import { ESLINT_PRESETS_FILE } from '#cli/config/generation/configurations/language/javascript/eslint/presets.ts';
import { LINTER_PACKAGES, PRESET_BLOCK_KEYS, LINTER_INSTALL_FOLDER } from '#cli/config/configurations/linter-lists.ts';

import {
    globalsModuleSchema,
    packageModuleSchema,
    testsManifestSchema,
    prettierModuleSchema,
    packageIdentitySchema,
    stylelintModuleSchema,
    eslintRuleModuleSchema,
    stylelintSettingsSchema,
} from '#cli/schemas/configurations/linter-lists.ts';

/**
 * Find the identity of the package owning a resolved module and require its declared pin.
 *
 * @param folder the installation folder.
 * @param packageName the owning package.
 * @param moduleName the public module export to resolve.
 * @param version the exact declared version.
 * @returns the validated package identity and entry path.
 */
function findInstalledPackage(
    folder: string,
    packageName: string,
    moduleName: string,
    version: string,
): InstalledPackage {
    const modulePath = createRequire(join(folder, LINTER_INSTALL_FOLDER.manifest)).resolve(moduleName);
    const document = readInstalledIdentity(modulePath, packageName);
    if (document.version !== version)
        throw new Error(`${packageName} installed at ${document.version}; its configuration pins ${version}.`);
    return { ...document, modulePath: modulePath };
}

/**
 * Find the package identity above one public module entry.
 *
 * @param modulePath the resolved module path.
 * @param packageName the expected owning package.
 * @returns the package document's name and version.
 */
function readInstalledIdentity(modulePath: string, packageName: string): PackageIdentity {
    for (let path = dirname(modulePath); path !== dirname(path); path = dirname(path)) {
        let text: string;
        try {
            text = readFileSync(join(path, LINTER_INSTALL_FOLDER.manifest), 'utf8');
        } catch (error) {
            if (!hasErrorCode(error, 'ENOENT')) throw error;
            continue;
        }
        const document = packageIdentitySchema.parse(JSON.parse(text));
        if (document.name === packageName) return document;
    }
    throw new Error(`No installed package named ${packageName} owns ${modulePath}.`);
}

/**
 * Capture the ordered JSON fields of a public ESLint preset without executable parser or plugin values.
 *
 * @param installed the package that exports the preset.
 * @param source the dotted export path, retaining slashes within keys.
 * @param module the package's default export.
 * @returns the validated copied preset.
 */
function capturePreset(installed: InstalledPackage, source: string, module: unknown): EslintPreset {
    let value = module;
    for (const key of source === '' ? [] : source.split('.')) {
        if (typeof value !== 'object' || value === null)
            throw new Error(`${installed.name} has no preset export ${source}.`);
        value = Reflect.get(value, key);
    }
    const blocks = (Array.isArray(value) ? value : [value]).map((block: unknown) => {
        if (typeof block !== 'object' || block === null)
            throw new Error(`${installed.name} preset ${source} must contain configuration objects.`);
        const language: unknown = Reflect.get(block, 'languageOptions');
        return {
            ...Object.fromEntries(
                PRESET_BLOCK_KEYS.flatMap((key) =>
                    Reflect.get(block, key) === undefined ? [] : [[key, Reflect.get(block, key)]],
                ),
            ),
            parser: typeof language === 'object' && language !== null && Reflect.get(language, 'parser') !== undefined,
        };
    });
    return eslintPresetSchema.parse({ package: installed.name, version: installed.version, source, blocks });
}

/**
 * Install only the packages used by copied exports, then resolve each at its declared version.
 *
 * @param folder the disposable installation folder.
 * @param dependencies the exact selected package versions.
 * @returns the installed packages keyed by name.
 */
async function installPackages(
    folder: string,
    dependencies: Record<string, string>,
): Promise<Map<string, InstalledPackage>> {
    writeFileSync(
        join(folder, LINTER_INSTALL_FOLDER.manifest),
        JSON.stringify({ private: true, type: 'module', dependencies }),
    );
    const install = await spawnProcess(LINTER_INSTALL_FOLDER.install, { cwd: folder });
    if (install.code !== 0)
        throw new Error(`Bun install failed, so the linter data stays as it was. ${install.stderr}`);
    return new Map(
        Object.entries(dependencies).map(([name, version]) => [
            name,
            findInstalledPackage(folder, name, name === 'eslint' ? LINTER_PACKAGES.eslint.module : name, version),
        ]),
    );
}

/**
 * Resolve the linter pins and their existing capture-workspace peer pins before loading package code.
 *
 * @param folder the disposable installation folder.
 * @param names the owners of the copied exports and formatter.
 * @returns the completed package installation.
 */
async function preparePackages(folder: string, names: Set<string>): Promise<Map<string, InstalledPackage>> {
    const versions = listToolProjectPins([...readConfigurations().values()]).npm;
    const dependencies = Object.fromEntries(
        [...names]
            .toSorted((first, second) => first.localeCompare(second))
            .map((name) => {
                const version = versions[name];
                if (version === undefined) throw new Error(`The configurations pin no version of ${name}.`);
                return [name, version];
            }),
    );
    const installed = await installPackages(folder, dependencies);
    const testsFile = fileURLToPath(new URL(LINTER_INSTALL_FOLDER.testsManifest, import.meta.url));
    const tests = testsManifestSchema.parse(JSON.parse(readFileSync(testsFile, 'utf8')));
    const peers = Object.fromEntries(
        [...installed.values()].flatMap(({ peerDependencies }) =>
            Object.keys(peerDependencies).flatMap((name) => {
                const version = tests.devDependencies[name];
                return names.has(name) || version === undefined ? [] : [[name, version]];
            }),
        ),
    );
    return Object.keys(peers).length === 0 ? installed : installPackages(folder, { ...dependencies, ...peers });
}

/**
 * Require the identity of a package selected for the installation.
 *
 * @param installed the completed installation's package identities.
 * @param name the selected package name.
 * @returns the installed entry.
 */
function getInstalledPackage(installed: Map<string, InstalledPackage>, name: string): InstalledPackage {
    const value = installed.get(name);
    if (value === undefined) throw new Error(`No installed entry was captured for ${name}.`);
    return value;
}

/**
 * Capture all three public name lists from the installed packages.
 *
 * @param installed the exact package identities and public entries.
 * @param folder the disposable installation folder.
 * @returns the copied documents by package-relative destination path.
 */
async function captureNames(installed: Map<string, InstalledPackage>, folder: string): Promise<Map<string, unknown>> {
    const eslint = getInstalledPackage(installed, 'eslint');
    const builtins = eslintRuleModuleSchema.parse(await import(pathToFileURL(eslint.modulePath).href));
    const globals = getInstalledPackage(installed, LINTER_PACKAGES.globals.module);
    const globalsExports = globalsModuleSchema.parse(await import(pathToFileURL(globals.modulePath).href));
    const standard = getInstalledPackage(installed, LINTER_PACKAGES.standard.module);
    const stylelint = getInstalledPackage(installed, LINTER_PACKAGES.stylelint.module);
    const stylelintExports = stylelintModuleSchema.parse(await import(pathToFileURL(stylelint.modulePath).href));
    const sample = join(folder, LINTER_INSTALL_FOLDER.sample);
    writeFileSync(sample, '');
    const style = stylelintSettingsSchema.parse(
        await stylelintExports.default.resolveConfig(sample, {
            config: { extends: standard.modulePath },
        }),
    );
    return new Map([
        [
            LINTER_PACKAGES.eslint.nameList.file,
            nameListSchema.parse({
                package: eslint.name,
                version: eslint.version,
                source: LINTER_PACKAGES.eslint.nameList.source,
                names: [...builtins.builtinRules.keys()].toSorted((first, second) => first.localeCompare(second)),
            }),
        ],
        [
            LINTER_PACKAGES.globals.nameList.file,
            nameListSchema.parse({
                package: globals.name,
                version: globals.version,
                source: LINTER_PACKAGES.globals.nameList.source,
                names: Object.keys(globalsExports.default).toSorted((first, second) => first.localeCompare(second)),
            }),
        ],
        [
            LINTER_PACKAGES.stylelint.nameList.file,
            nameListSchema.parse({
                package: standard.name,
                version: standard.version,
                source: LINTER_PACKAGES.stylelint.nameList.source,
                names: Object.keys(style.rules).toSorted((first, second) => first.localeCompare(second)),
            }),
        ],
    ]);
}

/**
 * Rewrite the copied exports after every import and schema check has succeeded.
 */
async function copyLinterLists(): Promise<void> {
    const recipes = listAssets('configurations/')
        .filter((path) => path.endsWith(`/${ESLINT_PRESETS_FILE}`))
        .map((path) => {
            const document: unknown = JSON.parse(readFileSync(buildAssetPath(path), 'utf8'));
            if (!isTable(document)) throw new Error(`${path} must contain a record of preset exports.`);
            const presets: EslintPresets = Object.fromEntries(
                Object.entries(document).map(([name, value]) => [name, eslintPresetSchema.parse(value)]),
            );
            return { path, presets };
        });
    const names = new Set([
        'eslint',
        LINTER_PACKAGES.globals.module,
        LINTER_PACKAGES.standard.module,
        LINTER_PACKAGES.stylelint.module,
        LINTER_PACKAGES.prettier.module,
        ...recipes.flatMap(({ presets }) => Object.values(presets).map((preset) => preset.package)),
    ]);
    using folder = createTemporaryFolder();
    const installed = await preparePackages(folder.path, names);
    const capturedNames = await captureNames(installed, folder.path);
    for (const { path, presets } of recipes) {
        const captured = [];
        for (const [name, preset] of Object.entries(presets)) {
            const owner = getInstalledPackage(installed, preset.package);
            const module = packageModuleSchema.parse(await import(pathToFileURL(owner.modulePath).href));
            captured.push([name, capturePreset(owner, preset.source, module.default)]);
        }
        capturedNames.set(path, Object.fromEntries(captured));
    }
    const prettier = getInstalledPackage(installed, LINTER_PACKAGES.prettier.module);
    const formatter = prettierModuleSchema.parse(await import(pathToFileURL(prettier.modulePath).href));
    const formatted = await Promise.all(
        [...capturedNames].map(
            async ([path, value]) =>
                [
                    path,
                    await formatter.format(JSON.stringify(value), {
                        ...(await formatter.resolveConfig(buildAssetPath(path))),
                        parser: 'json',
                        tabWidth: JSON_INDENT,
                    }),
                ] as const,
        ),
    );
    for (const [path, text] of formatted) writeFileSync(buildAssetPath(path), text);
    process.stdout.write(`Refreshed ${String(capturedNames.size)} linter data files.\n`);
}

await copyLinterLists();
