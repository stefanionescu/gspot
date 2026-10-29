import { join, dirname } from 'node:path';
import { JSON_INDENT } from '#cli/config/text.ts';
import { compareText } from '#cli/system/text.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnProcess } from '#cli/system/processes.ts';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { type NameList } from '#cli/types/configurations.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import { listAssets, buildAssetPath } from '#cli/system/assets.ts';
import { type EslintPreset } from '#cli/types/generation/eslint.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { ESLINT_RULE_NAMES_FILE } from '#cli/config/commands/explain.ts';
import { CONFIGURATIONS_FOLDER } from '#cli/config/configurations/names.ts';
import { ESLINT_GLOBAL_NAMES_FILE } from '#cli/config/settings/tools/tables.ts';
import { packageIdentitySchema, testsPackageJsonSchema } from '#cli/schemas/linter-exports.ts';
import { STYLELINT_RULE_NAMES_FILE } from '#cli/config/generation/configurations/language/css.ts';
import { INSTALL_PROJECT, LINTER_PACKAGES, PRESET_BLOCK_KEYS } from '#cli/config/linter-exports.ts';
import { eslintPresetSchema, eslintPresetsSchema } from '#cli/schemas/configurations/eslint-presets.ts';
import { ESLINT_PRESETS_FILE } from '#cli/config/generation/configurations/language/javascript/eslint/presets.ts';

import {
    type GlobalsModule,
    type PrettierModule,
    type PackageIdentity,
    type StylelintModule,
    type InstalledPackage,
    type EslintRuleModule,
} from '#cli/types/linter-exports.ts';

function readInstalledPackage(folder: string, packageName: string, moduleName: string): InstalledPackage {
    const modulePath = fileURLToPath(import.meta.resolve(moduleName, join(folder, INSTALL_PROJECT.manifest)));
    const document = readInstalledIdentity(modulePath, packageName);
    return { ...document, modulePath: modulePath };
}

function readInstalledIdentity(modulePath: string, packageName: string): PackageIdentity {
    for (let path = dirname(modulePath); path !== dirname(path); path = dirname(path)) {
        let text: string;
        try {
            text = readFileSync(join(path, INSTALL_PROJECT.manifest), 'utf8');
        } catch (error) {
            if (!hasErrorCode(error, 'ENOENT')) throw error;
            continue;
        }
        const document = packageIdentitySchema.parse(JSON.parse(text));
        if (document.name === packageName) return document;
    }
    throw new Error(`No installed package named ${packageName} owns ${modulePath}.`);
}

function buildPreset(installed: InstalledPackage, source: string, module: unknown): EslintPreset {
    let value = module;
    const keys = source === '' ? [] : source.split('.');
    for (const key of keys) {
        value = Reflect.get(value as object, key);
    }
    const blocks = (Array.isArray(value) ? value : [value]).map((block: unknown) => {
        const language: unknown = Reflect.get(block as object, 'languageOptions');
        return {
            ...Object.fromEntries(
                PRESET_BLOCK_KEYS.flatMap((key) =>
                    Reflect.get(block as object, key) === undefined ? [] : [[key, Reflect.get(block as object, key)]],
                ),
            ),
            parser: language !== null && typeof language === 'object' && Reflect.get(language, 'parser') !== undefined,
        };
    });
    return eslintPresetSchema.parse({ package: installed.name, version: installed.version, source, blocks });
}

async function installPackages(
    folder: string,
    dependencies: Record<string, string>,
): Promise<Map<string, InstalledPackage>> {
    writeFileSync(
        join(folder, INSTALL_PROJECT.manifest),
        JSON.stringify({ private: true, type: 'module', dependencies }),
    );
    const install = await spawnProcess(INSTALL_PROJECT.install, { cwd: folder });
    if (install.code !== 0)
        throw new Error(`Bun install failed, so the linter exports stay as they were. ${install.stderr}`);
    return new Map(
        Object.keys(dependencies).map((name) => [
            name,
            readInstalledPackage(folder, name, name === 'eslint' ? LINTER_PACKAGES.eslint.module : name),
        ]),
    );
}

async function preparePackages(folder: string, names: Set<string>): Promise<Map<string, InstalledPackage>> {
    const versions = listToolProjectPins(readConfigurations().values().toArray()).npm;
    const dependencies = Object.fromEntries(
        [...names]
            .toSorted((first, second) => compareText(first, second))
            .map((name) => {
                const version = versions[name];
                if (version === undefined) throw new Error(`The configurations pin no version of ${name}.`);
                return [name, version];
            }),
    );
    const installed = await installPackages(folder, dependencies);
    const testsFile = fileURLToPath(new URL(INSTALL_PROJECT.testsManifest, import.meta.url));
    const tests = testsPackageJsonSchema.parse(JSON.parse(readFileSync(testsFile, 'utf8')));
    const peers = Object.fromEntries(
        installed.values().flatMap(({ peerDependencies }) =>
            Object.keys(peerDependencies).flatMap((name) => {
                const version = tests.devDependencies[name];
                return version === undefined || names.has(name) ? [] : [[name, version]];
            }),
        ),
    );
    return Object.keys(peers).length === 0 ? installed : installPackages(folder, { ...dependencies, ...peers });
}

async function readNameLists(installed: Map<string, InstalledPackage>, folder: string): Promise<Map<string, unknown>> {
    const eslint = installed.get('eslint') as InstalledPackage;
    const builtins = (await import(pathToFileURL(eslint.modulePath).href)) as EslintRuleModule;
    const globals = installed.get(LINTER_PACKAGES.globals.module) as InstalledPackage;
    const globalsExports = (await import(pathToFileURL(globals.modulePath).href)) as GlobalsModule;
    const standard = installed.get(LINTER_PACKAGES.standard.module) as InstalledPackage;
    const stylelint = installed.get(LINTER_PACKAGES.stylelint.module) as InstalledPackage;
    const stylelintExports = (await import(pathToFileURL(stylelint.modulePath).href)) as { default: StylelintModule };
    const sample = join(folder, INSTALL_PROJECT.sample);
    writeFileSync(sample, '');
    const style = await stylelintExports.default.resolveConfig(sample, {
        config: { extends: standard.modulePath },
    });
    const eslintNames: NameList = {
        package: eslint.name,
        version: eslint.version,
        names: builtins.builtinRules
            .keys()
            .toArray()
            .toSorted((first, second) => compareText(first, second)),
    };
    const globalsNames: NameList = {
        package: globals.name,
        version: globals.version,
        names: Object.keys(globalsExports.default).toSorted((first, second) => compareText(first, second)),
    };
    const stylelintNames: NameList = {
        package: standard.name,
        version: standard.version,
        names: Object.keys(style.rules).toSorted((first, second) => compareText(first, second)),
    };
    return new Map([
        [ESLINT_RULE_NAMES_FILE, eslintNames],
        [ESLINT_GLOBAL_NAMES_FILE, globalsNames],
        [STYLELINT_RULE_NAMES_FILE, stylelintNames],
    ]);
}

async function writeLinterExports(): Promise<void> {
    const recipes = listAssets(`${CONFIGURATIONS_FOLDER}/`)
        .filter((path) => path.endsWith(`/${ESLINT_PRESETS_FILE}`))
        .map((path) => {
            const contents = readFileSync(buildAssetPath(path), 'utf8');
            const presets = eslintPresetsSchema.parse(JSON.parse(contents));
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
    const previousFolder = process.cwd();
    try {
        process.chdir(folder.path);
        const installed = await preparePackages(folder.path, names);
        const nameLists = await readNameLists(installed, folder.path);
        for (const { path, presets } of recipes) {
            const copied = [];
            for (const [name, preset] of Object.entries(presets)) {
                const owner = installed.get(preset.package) as InstalledPackage;
                const module = (await import(pathToFileURL(owner.modulePath).href)) as { default: unknown };
                copied.push([name, buildPreset(owner, preset.source, module.default)]);
            }
            nameLists.set(path, Object.fromEntries(copied));
        }
        const prettier = installed.get(LINTER_PACKAGES.prettier.module) as InstalledPackage;
        const formatter = (await import(pathToFileURL(prettier.modulePath).href)) as PrettierModule;
        const formatted = await Promise.all(
            [...nameLists].map(
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
        process.stdout.write(`Wrote ${String(nameLists.size)} linter export files.\n`);
    } finally {
        process.chdir(previousFolder);
    }
}

await writeLinterExports();
