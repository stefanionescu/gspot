import { join, dirname } from 'node:path';
import { JSON_INDENT } from '#cli/config/text.ts';
import { compareText } from '#cli/system/text.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnProcess } from '#cli/system/processes.ts';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { NameList } from '#cli/types/configurations.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import { listAssets, buildAssetPath } from '#cli/system/assets.ts';
import type { EslintPreset } from '#cli/types/generation/eslint.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { CONFIGURATIONS_FOLDER } from '#cli/config/configurations/names.ts';
import { eslintPresetSchema, eslintPresetsSchema } from '#cli/schemas/configurations/eslint-presets.ts';
import { testsManifestSchema, packageIdentitySchema } from '#cli/schemas/configurations/linter-exports.ts';
import { ESLINT_PRESETS_FILE } from '#cli/config/generation/configurations/language/javascript/eslint/presets.ts';

import {
    LINTER_PACKAGES,
    PRESET_BLOCK_KEYS,
    LINTER_INSTALL_FOLDER,
} from '#cli/config/configurations/linter-exports.ts';
import type {
    GlobalsModule,
    PrettierModule,
    PackageIdentity,
    StylelintModule,
    InstalledPackage,
    EslintRuleModule,
} from '#cli/types/linter-exports.ts';

function findInstalledPackage(folder: string, packageName: string, moduleName: string): InstalledPackage {
    const modulePath = fileURLToPath(import.meta.resolve(moduleName, join(folder, LINTER_INSTALL_FOLDER.manifest)));
    const document = readInstalledIdentity(modulePath, packageName);
    return { ...document, modulePath: modulePath };
}

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

function capturePreset(installed: InstalledPackage, source: string, module: unknown): EslintPreset {
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
        join(folder, LINTER_INSTALL_FOLDER.manifest),
        JSON.stringify({ private: true, type: 'module', dependencies }),
    );
    const install = await spawnProcess(LINTER_INSTALL_FOLDER.install, { cwd: folder });
    if (install.code !== 0)
        throw new Error(`Bun install failed, so the linter exports stay as they were. ${install.stderr}`);
    return new Map(
        Object.keys(dependencies).map((name) => [
            name,
            findInstalledPackage(folder, name, name === 'eslint' ? LINTER_PACKAGES.eslint.module : name),
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
    const testsFile = fileURLToPath(new URL(LINTER_INSTALL_FOLDER.testsManifest, import.meta.url));
    const tests = testsManifestSchema.parse(JSON.parse(readFileSync(testsFile, 'utf8')));
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

async function captureNames(installed: Map<string, InstalledPackage>, folder: string): Promise<Map<string, unknown>> {
    const eslint = installed.get('eslint') as InstalledPackage;
    const builtins = (await import(pathToFileURL(eslint.modulePath).href)) as EslintRuleModule;
    const globals = installed.get(LINTER_PACKAGES.globals.module) as InstalledPackage;
    const globalsExports = (await import(pathToFileURL(globals.modulePath).href)) as GlobalsModule;
    const standard = installed.get(LINTER_PACKAGES.standard.module) as InstalledPackage;
    const stylelint = installed.get(LINTER_PACKAGES.stylelint.module) as InstalledPackage;
    const stylelintExports = (await import(pathToFileURL(stylelint.modulePath).href)) as { default: StylelintModule };
    const sample = join(folder, LINTER_INSTALL_FOLDER.sample);
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
        [LINTER_PACKAGES.eslint.nameList.file, eslintNames],
        [LINTER_PACKAGES.globals.nameList.file, globalsNames],
        [LINTER_PACKAGES.stylelint.nameList.file, stylelintNames],
    ]);
}

async function copyLinterExports(): Promise<void> {
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
        const capturedNames = await captureNames(installed, folder.path);
        for (const { path, presets } of recipes) {
            const captured = [];
            for (const [name, preset] of Object.entries(presets)) {
                const owner = installed.get(preset.package) as InstalledPackage;
                const module = (await import(pathToFileURL(owner.modulePath).href)) as { default: unknown };
                captured.push([name, capturePreset(owner, preset.source, module.default)]);
            }
            capturedNames.set(path, Object.fromEntries(captured));
        }
        const prettier = installed.get(LINTER_PACKAGES.prettier.module) as InstalledPackage;
        const formatter = (await import(pathToFileURL(prettier.modulePath).href)) as PrettierModule;
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
        process.stdout.write(`Wrote ${String(capturedNames.size)} linter export files.\n`);
    } finally {
        process.chdir(previousFolder);
    }
}

await copyLinterExports();
