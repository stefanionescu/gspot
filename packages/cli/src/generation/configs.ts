import { join } from 'node:path/posix';
import { remember } from '#cli/system/cache.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import type { Config } from '#cli/types/manifests.ts';
import { buildConfig } from '#cli/generation/builders.ts';
import { CONFIG_SCOPES_FOLDER } from '#cli/config/generation/generation.ts';
import { buildLinkFiles, listLinkFilePaths } from '#cli/generation/links.ts';
import { getConfigTarget, listOwnedConfigs } from '#cli/generation/selection.ts';
import { isMarkdownlintShared } from '#cli/generation/configurations/language/markdown.ts';

import type {
    BuiltConfig,
    OwnedConfig,
    OwnedSourceFile,
    ConfigGeneration,
    ConfigBuildState,
} from '#cli/types/generation/files.ts';

const CONFIGS = Symbol('config files');

/**
Reuse generated settings only while the session keeps the same run cache.

@param session the current settings, scopes, and repository files.
*/
export function buildConfigs(session: Session): ConfigGeneration {
    const repositorySession =
        session.root === session.repository.root ? session : { ...session, root: session.repository.root };
    return remember(session.cache, CONFIGS, session.repository, () => buildScopeConfigs(repositorySession));
}

function buildOwnedOutput(
    owned: OwnedSourceFile,
    ownedFiles: OwnedSourceFile[],
    generated: ConfigBuildState,
): BuiltConfig[] {
    try {
        return [{ ...owned, ...buildConfig(owned, owned.config.target, generated.targets) }];
    } catch (error) {
        if (!(error instanceof GspotError)) throw error;
        for (const { owner, config } of owned.config.per_scope ? [owned] : ownedFiles) {
            const scope = owner.scope.path;
            const failures = generated.failures.get(scope) ?? new Map<string, Error>();
            failures.set(config.target, error);
            generated.failures.set(scope, failures);
        }
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
    const { file, companions } = written === target ? first : buildConfig(first, written, generated.targets);
    for (const written of [file, ...companions]) generated.files.set(written.path, written);
    for (const { owner } of group) {
        const scope = owner.scope.path;
        const paths = generated.targets.get(scope) ?? new Map<string, string>();
        paths.set(target, written);
        generated.targets.set(scope, paths);
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

function listTargetLinkFiles(configs: OwnedConfig[], selected: OwnedConfig): Set<string> {
    return new Set(
        configs
            .filter(
                (each) =>
                    each.owner.scope.path === selected.owner.scope.path &&
                    each.config.source === undefined &&
                    each.config.target === selected.config.target,
            )
            .flatMap((each) => listLinkFilePaths(each.owner, each.config)),
    );
}

function listLinkFileTargets(
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

function addLinkFiles(selected: OwnedConfig, configs: OwnedConfig[], generated: ConfigBuildState): void {
    const { config, owner } = selected;
    if (isMarkdownlintShared(selected, configs)) return;
    const targetLinkFiles = listTargetLinkFiles(configs, selected);
    for (const linkFile of buildLinkFiles(owner, config, listLinkFileTargets(selected, configs, generated))) {
        if (config.source === undefined || config.pointer?.folders !== undefined || !targetLinkFiles.has(linkFile.path))
            generated.files.set(linkFile.path, linkFile);
    }
}

function buildScopeConfigs(session: Session): ConfigGeneration {
    const configs = listOwnedConfigs(session);
    const state: ConfigBuildState = { targets: new Map(), files: new Map(), failures: new Map() };
    addSourceFiles(configs, state);
    for (const config of configs)
        if (state.failures.get(config.owner.scope.path)?.has(config.config.target) !== true)
            addLinkFiles(config, configs, state);
    return { files: state.files.values().toArray(), targets: state.targets, failures: state.failures };
}

function buildPerScopeTarget(config: Pick<Config, 'target' | 'file' | 'root'>, scopePath: string): string {
    if (config.root) return join(scopePath, config.target);
    const folder = config.target.slice(0, config.target.length - config.file.length);
    return join(folder, CONFIG_SCOPES_FOLDER, scopePath, config.file);
}
