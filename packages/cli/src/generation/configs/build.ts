import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path/posix';

import { CONFIG_SCOPES_FOLDER, TS_EXTENSION } from '#cli/config/generation/files.ts';
import { CONFIG_BUILDERS } from '#cli/configurations/registry.ts';
import { getConfigTarget } from '#cli/engine/run/tool-runs/configs.ts';
import { formatHeader } from '#cli/generation/builders/header.ts';
import { buildIgnoreSections } from '#cli/generation/configs/ignores.ts';
import { listOwnedConfigs } from '#cli/generation/configs/owned.ts';
import { buildPointerFiles, isPointerInherited, listPointerPaths } from '#cli/generation/configs/pointers.ts';
import { remember } from '#cli/system/cache.ts';
import { GspotError } from '#cli/system/errors.ts';
import { buildAssetPath } from '#cli/system/package/assets.ts';
import { requireTypescript } from '#cli/system/package/typescript.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';
import type { ConfigGeneration } from '#cli/types/engine/tool-runs.ts';
import type { BuiltConfig, ConfigBuildState, OwnedConfig, OwnedSourceFile } from '#cli/types/generation.ts';
import type { Config } from '#cli/types/manifests.ts';
import type { Session } from '#cli/types/tools.ts';

const CONFIGS = Symbol('config files');

function replaceReferences(
    content: string,
    config: Config,
    targetPath: string,
    targets: ReadonlyMap<string, string> | undefined,
): string {
    let text = content;
    for (const reference of config.references) {
        const mapped = targets?.get(join(dirname(config.target), reference));
        if (mapped !== undefined)
            text = text.replaceAll(`'${reference}'`, () => `'${relative(dirname(targetPath), mapped)}'`);
    }
    return text;
}

function addConfigFailures(generated: ConfigBuildState, owners: OwnedSourceFile[], error: GspotError): void {
    for (const { owner, config } of owners) {
        const scopePath = owner.scope.path;
        const failures = generated.failures.get(scopePath) ?? new Map<string, Error>();
        failures.set(config.target, error);
        generated.failures.set(scopePath, failures);
    }
}

function buildOwnedOutput(
    owned: OwnedSourceFile,
    ownedFiles: OwnedSourceFile[],
    generated: ConfigBuildState,
): BuiltConfig[] {
    try {
        return [{ ...owned, ...buildConfigFile(owned, owned.config.target, generated) }];
    } catch (error) {
        if (!(error instanceof GspotError)) throw error;
        addConfigFailures(generated, owned.config.per_scope ? [owned] : ownedFiles, error);
        return [];
    }
}

function listToolOutputs(ownedFiles: OwnedSourceFile[], generated: ConfigBuildState): BuiltConfig[][] {
    const owners = ownedFiles[0]?.config.per_scope === true ? ownedFiles : ownedFiles.slice(0, 1);
    const outputs = owners.flatMap((each) => buildOwnedOutput(each, ownedFiles, generated));
    return Map.groupBy(outputs, ({ file }) => file.content)
        .values()
        .toArray()
        .toSorted(
            (left, right) =>
                Number(right.some(({ owner }) => owner.scope.path === '')) -
                    Number(left.some(({ owner }) => owner.scope.path === '')) || right.length - left.length,
        );
}

function addToolOutput(target: string, group: BuiltConfig[], index: number, generated: ConfigBuildState): void {
    const [first] = group as [BuiltConfig, ...BuiltConfig[]];
    const written = index === 0 ? target : buildPerScopeTarget(first.config, first.owner.scope.path);
    const { file, companions } = written === target ? first : buildConfigFile(first, written, generated);
    for (const written of [file, ...companions]) generated.files.set(written.path, written);
    for (const { owner } of group) {
        const scopePath = owner.scope.path;
        const paths = generated.targets.get(scopePath) ?? new Map<string, string>();
        paths.set(target, written);
        generated.targets.set(scopePath, paths);
    }
}

function addSourceFiles(configs: OwnedConfig[], generated: ConfigBuildState): void {
    const sourced = configs.filter((each): each is OwnedSourceFile => each.config.source !== undefined);
    const sources = Map.groupBy(sourced, ({ config }) => config.target);
    for (const [target, ownedFiles] of sources) {
        const groups = listToolOutputs(ownedFiles, generated);
        for (const [index, group] of groups.entries()) addToolOutput(target, group, index, generated);
    }
}

function listTargetPointers(configs: OwnedConfig[], selected: OwnedConfig): Set<string> {
    return new Set(
        configs
            .filter(
                (each) =>
                    each.owner.scope.path === selected.owner.scope.path &&
                    each.config.source === undefined &&
                    each.config.target === selected.config.target,
            )
            .flatMap((each) => listPointerPaths(each.owner, each.config)),
    );
}

function listPointerTargets(
    selected: OwnedConfig,
    configs: OwnedConfig[],
    generated: ConfigBuildState,
): Map<string, string> {
    const { config } = selected;
    const owners =
        config.pointer?.overrides === true
            ? configs.filter(
                  (each) =>
                      each.config.target === config.target &&
                      generated.failures.get(each.owner.scope.path)?.has(config.target) !== true,
              )
            : [selected];
    return new Map(
        owners.map((each) => [each.owner.scope.path, getConfigTarget(each.owner.scope.path, each.config, generated)]),
    );
}

function addPointerFiles(selected: OwnedConfig, configs: OwnedConfig[], generated: ConfigBuildState): void {
    const { config, owner } = selected;
    if (isPointerInherited(selected, generated)) return;
    const targetPointers = listTargetPointers(configs, selected);
    const pointers = buildPointerFiles(owner, config, listPointerTargets(selected, configs, generated));
    for (const pointer of pointers) {
        if (config.source === undefined || config.pointer?.folders !== undefined || !targetPointers.has(pointer.path))
            generated.files.set(pointer.path, pointer);
    }
}

function buildScopeConfigs(session: Session): ConfigGeneration {
    const configs = listOwnedConfigs(session);
    const state: ConfigBuildState = { targets: new Map(), files: new Map(), failures: new Map(), ignoreSections: [] };
    // A tool that inherits its parent config reads no ignores, and the ignores leave out the pointers it does not need.
    addSourceFiles(
        configs.filter(({ config }) => config.pointer?.inherit === true),
        state,
    );
    state.ignoreSections = buildIgnoreSections(session, state);
    addSourceFiles(
        configs.filter(({ config }) => config.pointer?.inherit !== true),
        state,
    );
    for (const config of configs)
        if (state.failures.get(config.owner.scope.path)?.has(config.config.target) !== true)
            addPointerFiles(config, configs, state);
    return { files: state.files.values().toArray(), targets: state.targets, failures: state.failures };
}

function buildPerScopeTarget(config: Pick<Config, 'target' | 'file' | 'root'>, scopePath: string): string {
    if (config.root) return join(scopePath, config.target);
    const folder = config.target.slice(0, config.target.length - config.file.length);
    return join(folder, CONFIG_SCOPES_FOLDER, scopePath, config.file);
}

function buildConfigFile(
    owned: OwnedSourceFile,
    targetPath: string,
    generated: Pick<ConfigBuildState, 'targets' | 'ignoreSections'>,
): Pick<BuiltConfig, 'file' | 'companions'> {
    const { config, owner } = owned;
    const planned: PlannedConfig = {
        ...owner,
        config,
        targetPath,
        ignoreSections: generated.ignoreSections,
        level: owner.session.settings.level,
    };
    const builder = CONFIG_BUILDERS[`${planned.configuration.name}/${config.file}`];
    let built: ReturnType<ConfigBuilder>;
    if (builder === undefined) {
        const source = config.source;
        const shipped = readFileSync(buildAssetPath(`${planned.configuration.folder}/${source}`), 'utf8');
        const ts = source.endsWith(TS_EXTENSION) ? requireTypescript() : undefined;
        built =
            ts === undefined
                ? shipped
                : ts.transpileModule(shipped, {
                      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
                  }).outputText;
    } else built = builder(planned);
    const { content, companions } = typeof built === 'string' ? { content: built, companions: [] } : built;
    const source = replaceReferences(content, config, targetPath, generated.targets.get(planned.scope.path));
    return {
        file: { path: targetPath, content: `${formatHeader(targetPath)}${source.trimEnd()}\n` },
        companions: companions.map((companion) => ({
            path: companion.path,
            content: `${formatHeader(companion.path)}${companion.content.trimEnd()}\n`,
        })),
    };
}

/**
Reuse the built configs while the session keeps its run cache and its reading of the repository.
*/
export function buildConfigs(session: Session): ConfigGeneration {
    const repositorySession =
        session.root === session.repository.root ? session : { ...session, root: session.repository.root };
    return remember(session.cache, CONFIGS, session.repository, () => buildScopeConfigs(repositorySession));
}
