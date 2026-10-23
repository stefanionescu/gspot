// Build each distinct config file text once, and give its path to every scope that uses it.
import { join } from 'node:path/posix';
import type { Session } from '#cli/types/session.ts';
import { type CacheKey } from '#cli/types/system/files.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import type { ConfigFile } from '#cli/types/configurations.ts';
import { buildConfigFile } from '#cli/generation/config-files/build.ts';
import { CONFIG_FILE_SCOPES_FOLDER } from '#cli/config/generation/config-files/generate.ts';
import { listPointerPaths, buildPointerFiles } from '#cli/generation/config-files/pointers.ts';
import { getConfigFileTarget, listOwnedConfigFiles } from '#cli/generation/config-files/selection.ts';

import type {
    WholeConfigFile,
    BuiltConfigFile,
    OwnedConfigFile,
    ConfigFileGeneration,
    GeneratedConfigFiles,
} from '#cli/types/generation/files.ts';

const configFilesKey: CacheKey<Map<Session, ConfigFileGeneration>> = { create: () => new Map() };

/**
 * Reuse generated settings only while the session keeps the same repository read cache.
 *
 * @param session the current settings, scopes, and repository files.
 * @returns the generated settings and scope destinations.
 */
export function getConfigFiles(session: Session): ConfigFileGeneration {
    return getCachedMapValue(session.reads, configFilesKey, session, () => buildConfigFiles(session));
}

// Root outputs win the shared path; other equal-content groups prefer the most scopes.
function groupToolOutputs(
    ownedFiles: (OwnedConfigFile & { configFile: WholeConfigFile })[],
    generated: GeneratedConfigFiles,
): BuiltConfigFile[][] {
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
    return [...Map.groupBy(outputs, ({ file }) => file.content).values()].toSorted(
        (left, right) =>
            Number(right.some(({ owner }) => owner.scope.folder.path === '')) -
                Number(left.some(({ owner }) => owner.scope.folder.path === '')) || right.length - left.length,
    );
}

// Record one text group at its chosen path and map every participating scope to it.
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

// Build the config files that have their own text first, so that the pointers can name their paths.
function buildSourceFiles(configFiles: OwnedConfigFile[], generated: GeneratedConfigFiles): void {
    const sourced = configFiles.filter(
        (each): each is OwnedConfigFile & { configFile: WholeConfigFile } => each.configFile.source !== undefined,
    );
    for (const [declared, ownedFiles] of Map.groupBy(sourced, ({ configFile }) => configFile.target)) {
        const groups = groupToolOutputs(ownedFiles, generated);
        for (const [index, group] of groups.entries()) addToolOutput(declared, group, index, generated);
    }
}

// A pointer-only config file replaces the generic one for the same scope and target.
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
    const target = getConfigFileTarget(owner.scope.folder.path, configFile, generated.targets);
    if (isRootPointerShared(selected, configFiles, target)) return;
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

// A scope that uses the same config file as the root needs no pointer of its own when the pointer inherits.
function isRootPointerShared(selected: OwnedConfigFile, configFiles: OwnedConfigFile[], target: string): boolean {
    const { configFile, owner } = selected;
    if (configFile.pointer?.inherit !== true || owner.scope.folder.path === '' || target !== configFile.target)
        return false;
    return configFiles.some(
        (each) => each.configFile.target === configFile.target && each.owner.scope.folder.path === '',
    );
}

/**
 * Build the config files. Scopes with the same text share one file, and every pointer resolves to its path.
 *
 * @param session the repository to build for.
 * @returns the config files, and the path that each scope uses.
 */
function buildConfigFiles(session: Session): ConfigFileGeneration {
    const configFiles = listOwnedConfigFiles(session);
    const state: GeneratedConfigFiles = { targets: new Map(), files: new Map() };
    buildSourceFiles(configFiles, state);
    for (const configFile of configFiles) addPointerFiles(configFile, configFiles, state);
    return { files: [...state.files.values()], targets: state.targets };
}

/**
 * Name the path of a config file that a scope writes with its own text: a root file in the scope folder, and any other
 * config file in scopes/<scope>/ of the folder of its configuration.
 *
 * @param configFile the config file to place.
 * @param scope the folder of the scope.
 * @returns the repository-relative path.
 */
export function buildPerScopeTarget(configFile: Pick<ConfigFile, 'target' | 'file' | 'root'>, scope: string): string {
    if (configFile.root) return join(scope, configFile.target);
    const folder = configFile.target.slice(0, configFile.target.length - configFile.file.length);
    return join(folder, CONFIG_FILE_SCOPES_FOLDER, scope, configFile.file);
}
