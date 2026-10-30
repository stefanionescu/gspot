import { join } from 'node:path/posix';
import { remember } from '#cli/system/cache.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import type { ConfigFile } from '#cli/types/manifests.ts';
import { buildConfigFile } from '#cli/generation/config-files/build.ts';
import { isMarkdownlintShared } from '#cli/generation/configurations/language/markdown.ts';
import { CONFIG_FILE_SCOPES_FOLDER } from '#cli/config/generation/config-files/generate.ts';
import { buildLinkFiles, listLinkFilePaths } from '#cli/generation/config-files/link-files.ts';
import { getConfigFileTarget, listOwnedConfigFiles } from '#cli/generation/config-files/selection.ts';

import type {
    BuiltConfigFile,
    OwnedConfigFile,
    OwnedSourceFile,
    ConfigFileGeneration,
    ConfigFileBuildState,
} from '#cli/types/generation/files.ts';

const CONFIG_FILES = Symbol('config files');

/**
Reuse generated settings only while the session keeps the same run cache.

@param session the current settings, scopes, and repository files.
*/
export function buildConfigFiles(session: Session): ConfigFileGeneration {
    const repositorySession =
        session.root === session.repository.root ? session : { ...session, root: session.repository.root };
    return remember(session.cache, CONFIG_FILES, session.repository, () => buildScopeConfigFiles(repositorySession));
}

function buildOwnedOutput(
    owned: OwnedSourceFile,
    ownedFiles: OwnedSourceFile[],
    generated: ConfigFileBuildState,
): BuiltConfigFile[] {
    try {
        return [{ ...owned, ...buildConfigFile(owned, owned.configFile.target, generated.targets) }];
    } catch (error) {
        if (!(error instanceof GspotError)) throw error;
        for (const { owner, configFile } of owned.configFile.per_scope ? [owned] : ownedFiles) {
            const scope = owner.scope.path;
            const failures = generated.failures.get(scope) ?? new Map<string, Error>();
            failures.set(configFile.target, error);
            generated.failures.set(scope, failures);
        }
        return [];
    }
}

function groupToolOutputs(ownedFiles: OwnedSourceFile[], generated: ConfigFileBuildState): BuiltConfigFile[][] {
    const owners = ownedFiles[0]?.configFile.per_scope === true ? ownedFiles : ownedFiles.slice(0, 1);
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

function addToolOutput(target: string, group: BuiltConfigFile[], index: number, generated: ConfigFileBuildState): void {
    const [first] = group as [BuiltConfigFile, ...BuiltConfigFile[]];
    const written = index === 0 ? target : buildPerScopeTarget(first.configFile, first.owner.scope.path);
    const { file, companions } = written === target ? first : buildConfigFile(first, written, generated.targets);
    for (const written of [file, ...companions]) generated.files.set(written.path, written);
    for (const { owner } of group) {
        const scope = owner.scope.path;
        const paths = generated.targets.get(scope) ?? new Map<string, string>();
        paths.set(target, written);
        generated.targets.set(scope, paths);
    }
}

function addSourceFiles(configFiles: OwnedConfigFile[], generated: ConfigFileBuildState): void {
    const sourced = configFiles.filter((each): each is OwnedSourceFile => each.configFile.source !== undefined);
    const sources = Map.groupBy(sourced, ({ configFile }) => configFile.target);
    for (const [target, ownedFiles] of sources) {
        const groups = groupToolOutputs(ownedFiles, generated);
        for (const [index, group] of groups.entries()) addToolOutput(target, group, index, generated);
    }
}

function listTargetLinkFiles(configFiles: OwnedConfigFile[], selected: OwnedConfigFile): Set<string> {
    return new Set(
        configFiles
            .filter(
                (each) =>
                    each.owner.scope.path === selected.owner.scope.path &&
                    each.configFile.source === undefined &&
                    each.configFile.target === selected.configFile.target,
            )
            .flatMap((each) => listLinkFilePaths(each.owner, each.configFile)),
    );
}

function listLinkFileTargets(
    selected: OwnedConfigFile,
    configFiles: OwnedConfigFile[],
    generated: ConfigFileBuildState,
): Map<string, string> {
    const { configFile } = selected;
    const owners =
        configFile.pointer?.overrides === true
            ? configFiles.filter(
                  (each) =>
                      each.configFile.target === configFile.target &&
                      generated.failures.get(each.owner.scope.path)?.has(configFile.target) !== true,
              )
            : [selected];
    return new Map(
        owners.map((each) => [
            each.owner.scope.path,
            getConfigFileTarget(each.owner.scope.path, each.configFile, generated),
        ]),
    );
}

function addLinkFiles(
    selected: OwnedConfigFile,
    configFiles: OwnedConfigFile[],
    generated: ConfigFileBuildState,
): void {
    const { configFile, owner } = selected;
    if (isMarkdownlintShared(selected, configFiles)) return;
    const targetLinkFiles = listTargetLinkFiles(configFiles, selected);
    for (const linkFile of buildLinkFiles(owner, configFile, listLinkFileTargets(selected, configFiles, generated))) {
        if (
            configFile.source === undefined ||
            configFile.pointer?.folders !== undefined ||
            !targetLinkFiles.has(linkFile.path)
        )
            generated.files.set(linkFile.path, linkFile);
    }
}

function buildScopeConfigFiles(session: Session): ConfigFileGeneration {
    const configFiles = listOwnedConfigFiles(session);
    const state: ConfigFileBuildState = { targets: new Map(), files: new Map(), failures: new Map() };
    addSourceFiles(configFiles, state);
    for (const configFile of configFiles)
        if (state.failures.get(configFile.owner.scope.path)?.has(configFile.configFile.target) !== true)
            addLinkFiles(configFile, configFiles, state);
    return { files: state.files.values().toArray(), targets: state.targets, failures: state.failures };
}

function buildPerScopeTarget(configFile: Pick<ConfigFile, 'target' | 'file' | 'root'>, scopePath: string): string {
    if (configFile.root) return join(scopePath, configFile.target);
    const folder = configFile.target.slice(0, configFile.target.length - configFile.file.length);
    return join(folder, CONFIG_FILE_SCOPES_FOLDER, scopePath, configFile.file);
}
