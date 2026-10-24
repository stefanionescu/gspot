import { join } from 'node:path/posix';
import type { Session } from '#cli/types/session.ts';
import { type CacheKey } from '#cli/types/system/files.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import type { ConfigFile } from '#cli/types/configurations.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import { buildConfigFile } from '#cli/generation/config-files/build.ts';
import { CONFIG_FILE_SCOPES_FOLDER } from '#cli/config/generation/config-files/generate.ts';
import { listPointerPaths, buildPointerFiles } from '#cli/generation/config-files/pointers.ts';
import { isRootTextShared, getConfigFileTarget, listOwnedConfigFiles } from '#cli/generation/config-files/selection.ts';

import type {
    BuiltConfigFile,
    OwnedConfigFile,
    OwnedSourceFile,
    ConfigFileGeneration,
    GeneratedConfigFiles,
} from '#cli/types/generation/files.ts';

const configFilesKey: CacheKey<Map<Repository, ConfigFileGeneration>> = { create: () => new Map() };

/**
Reuse generated settings only while the session keeps the same repository read cache.

@param session the current settings, scopes, and repository files.
@returns the generated settings and scope destinations.
*/
export function getConfigFiles(session: Session): ConfigFileGeneration {
    const repositorySession =
        session.root === session.repository.root ? session : { ...session, root: session.repository.root };
    return getCachedMapValue(session.reads, configFilesKey, session.repository, () =>
        buildConfigFiles(repositorySession),
    );
}

function groupToolOutputs(ownedFiles: OwnedSourceFile[], generated: GeneratedConfigFiles): BuiltConfigFile[][] {
    const owners = ownedFiles[0]?.configFile.per_scope === true ? ownedFiles : ownedFiles.slice(0, 1);
    const outputs = owners.map((each) => ({
        ...each,
        ...buildConfigFile(
            {
                ...each.owner,
                configFile: each.configFile,
                targetPath: each.configFile.target,
                level: each.owner.session.settingsFile.settings.level,
            },
            generated.targets,
        ),
    }));
    return Map.groupBy(outputs, ({ file }) => file.content)
        .values()
        .toArray()
        .toSorted(
            (left, right) =>
                Number(right.some(({ owner }) => owner.scope.folder.path === '')) -
                    Number(left.some(({ owner }) => owner.scope.folder.path === '')) || right.length - left.length,
        );
}

function addToolOutput(target: string, group: BuiltConfigFile[], index: number, generated: GeneratedConfigFiles): void {
    const [first] = group as [BuiltConfigFile, ...BuiltConfigFile[]];
    const chosen = index === 0 ? target : buildPerScopeTarget(first.configFile, first.owner.scope.folder.path);
    const { file, companions } =
        chosen === target
            ? first
            : buildConfigFile(
                  {
                      ...first.owner,
                      configFile: first.configFile,
                      targetPath: chosen,
                      level: first.owner.session.settingsFile.settings.level,
                  },
                  generated.targets,
              );
    for (const written of [file, ...companions]) generated.files.set(written.path, written);
    for (const { owner } of group) {
        const scope = owner.scope.folder.path;
        const paths = generated.targets.get(scope) ?? new Map<string, string>();
        paths.set(target, chosen);
        generated.targets.set(scope, paths);
    }
}

function buildSourceFiles(configFiles: OwnedConfigFile[], generated: GeneratedConfigFiles): void {
    const sourced = configFiles.filter((each): each is OwnedSourceFile => each.configFile.source !== undefined);
    const sources = Map.groupBy(sourced, ({ configFile }) => configFile.target);
    for (const [declared, ownedFiles] of sources) {
        const groups = groupToolOutputs(ownedFiles, generated);
        for (const [index, group] of groups.entries()) addToolOutput(declared, group, index, generated);
    }
}

function listPointerOnlyPaths(configFiles: OwnedConfigFile[], selected: OwnedConfigFile): Set<string> {
    return new Set(
        configFiles
            .filter(
                (each) =>
                    each.owner.scope.folder.path === selected.owner.scope.folder.path &&
                    each.configFile.source === undefined &&
                    each.configFile.target === selected.configFile.target,
            )
            .flatMap((each) => listPointerPaths(each.owner, each.configFile)),
    );
}

function addPointerFiles(
    selected: OwnedConfigFile,
    configFiles: OwnedConfigFile[],
    generated: GeneratedConfigFiles,
): void {
    const { configFile, owner } = selected;
    if (isRootTextShared(selected, configFiles)) return;
    const target = getConfigFileTarget(owner.scope.folder.path, configFile, generated.targets);
    const pointerOnlyPaths = listPointerOnlyPaths(configFiles, selected);
    for (const pointer of buildPointerFiles(owner, configFile, target)) {
        if (
            configFile.source === undefined ||
            configFile.pointer?.folders !== undefined ||
            !pointerOnlyPaths.has(pointer.path)
        )
            generated.files.set(pointer.path, pointer);
    }
}

function buildConfigFiles(session: Session): ConfigFileGeneration {
    const configFiles = listOwnedConfigFiles(session);
    const state: GeneratedConfigFiles = { targets: new Map(), files: new Map() };
    buildSourceFiles(configFiles, state);
    for (const configFile of configFiles) addPointerFiles(configFile, configFiles, state);
    return { files: state.files.values().toArray(), targets: state.targets };
}

function buildPerScopeTarget(configFile: Pick<ConfigFile, 'target' | 'file' | 'root'>, scope: string): string {
    if (configFile.root) return join(scope, configFile.target);
    const folder = configFile.target.slice(0, configFile.target.length - configFile.file.length);
    return join(folder, CONFIG_FILE_SCOPES_FOLDER, scope, configFile.file);
}
