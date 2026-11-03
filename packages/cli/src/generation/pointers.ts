import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { compareText } from '#cli/system/text.ts';
import { getRequired } from '#cli/system/tables.ts';
import { tryParseFile } from '#cli/system/errors.ts';
import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import { listCheckTools } from '#cli/engine/tools.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import type { Session, GeneratedFile } from '#cli/types/tools.ts';
import type { PlannedPointerField } from '#cli/types/generation.ts';
import type { Config, ManagedKeys } from '#cli/types/repository.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import { getConfigTarget } from '#cli/engine/tool-runs/placeholders.ts';
import type { ConfigOwner } from '#cli/types/configurations/language.ts';
import { joinScope, listNestedScopes, isOutsideChildScopes } from '#cli/repository/scopes.ts';

import {
    isInScope,
    escapeGlob,
    findOutermostFolder,
    extractParentFolder,
    buildModuleSpecifier,
} from '#cli/system/paths.ts';
import {
    GITHUB_WORKFLOW,
    GITLAB_WORKFLOW,
    TARGET_PLACEHOLDER,
    OVERRIDES_PLACEHOLDER,
    TARGET_MODULE_PLACEHOLDER,
} from '#cli/config/generation.ts';

function fillTarget(body: string, pointerPath: string, targetPath: string): string {
    const target = buildModuleSpecifier(pointerPath, targetPath);
    return body.replaceAll(TARGET_PLACEHOLDER, (placeholder) => {
        if (placeholder === TARGET_MODULE_PLACEHOLDER) {
            return JSON.stringify(
                target
                    .split('/')
                    .map((segment) => encodeURIComponent(segment))
                    .join('/'),
            );
        }
        return JSON.stringify(target);
    });
}

function buildPointerLocation(
    file: Config,
    target: string,
    scope: string,
    scopePaths: PlannedPointerField['scopePaths'],
): { scope: string; children: string[]; target: string } {
    const scopePath = file.per_scope ? scope : '';
    const children = file.per_scope ? listNestedScopes(scopePaths, scopePath) : [];
    const pointerPath =
        file.pointer === undefined || (scopePath !== '' && file.pointer.overrides === true)
            ? target
            : joinScope(scopePath, file.pointer.path);
    return { scope: scopePath, children, target: pointerPath };
}

function listPointerFieldTargets({
    scope,
    configuration,
    tool,
    consumed,
    paths,
    configs,
    scopePaths,
}: PlannedPointerField) {
    return (tool.replace_key ?? [])
        .filter((replacement) => replacement.pointer === true)
        .flatMap((replacement) =>
            configuration.configs
                .map((file) => ({ file, target: getConfigTarget(scope.path, file, configs) }))
                .filter(
                    ({ file, target }) =>
                        file.tool.includes(tool.name) && (consumed || !file.per_scope || !paths.has(target)),
                )
                .map(({ file, target }) => ({
                    key: replacement.key,
                    ...buildPointerLocation(file, target, scope.path, scopePaths),
                })),
        );
}

function listPointerFieldTools(session: Session) {
    return session.scopes.flatMap((scope) => {
        const required = new Set(
            session.configuredChecks
                .filter((planned) => planned.scope.path === scope.path || planned.check.runs === 'once')
                .flatMap((check) => listCheckTools(check)),
        );
        return readConfigurations()
            .values()
            .flatMap((configuration) =>
                configuration.tools.map((tool) => ({ scope, configuration, tool, consumed: required.has(tool.name) })),
            )
            .toArray();
    });
}

/**
List the paths where a config file puts its pointer file. Every scope shares one pointer file with overrides, at the root.
Another pointer file sits at one path, or in each folder that holds files of the configuration and matches pointer.folders.

@param owner the repository and the scope.
@param config the config file from the manifest.
@returns each path where the pointer file goes, from the repository root.
*/
export function listPointerPaths(owner: ConfigOwner, config: Config): string[] {
    const { scope, configuration } = owner;
    const { scopes, repository } = owner.session;
    const { pointer } = config;
    if (pointer === undefined) return [];
    const scopePath = scope.path;
    if (pointer.folders === undefined)
        return [config.per_scope && pointer.overrides !== true ? joinScope(scopePath, pointer.path) : pointer.path];
    const children = listNestedScopes(
        scopes.map((each) => each.path),
        scopePath,
    );
    const isMatch = buildPathMatcher(pointer.folders);
    const owned = listCoveredFiles(configuration.files, repository.files, {
        configurations: scope.configurations,
        scopePath: '',
        settings: scope.settings,
    }).filter((file) => isInScope(file.path, scopePath) && isOutsideChildScopes(file.path, children));
    const folders = new Set(
        owned.flatMap(({ path }) => {
            const folder = findOutermostFolder(extractParentFolder(path), isMatch);
            if (folder === undefined) return [];
            return [isInScope(folder, scopePath) ? folder : scopePath];
        }),
    );
    return [...folders].map((folder) => `${folder}/${pointer.path}`);
}

/**
List every path outside .gspot/ that gspot can write. Include manifest targets and pointer files at each scope root and pointer file folder, and both CI workflow paths.

@param session the scopes and the configurations.
@returns the paths, from the repository root.
*/
export function listOwnablePaths(session: Session): Set<string> {
    const configs = session.scopes.flatMap((scope) =>
        readConfigurations()
            .values()
            .flatMap((configuration) =>
                configuration.configs.map((config) => ({
                    owner: { session, scope, configuration },
                    config,
                })),
            )
            .toArray(),
    );
    const paths = configs.flatMap(({ owner, config }) => [
        ...(config.source === undefined || isGspotPath(config.target)
            ? []
            : [config.per_scope ? joinScope(owner.scope.path, config.target) : config.target]),
        ...listPointerPaths(owner, config),
    ]);
    return new Set([GITHUB_WORKFLOW, GITLAB_WORKFLOW, ...paths]);
}

/**
Point the package fields that manifests declare at the generated config files.

@param session the repository files and scopes.
@param generated the config files that this run generates.
@param configs the config file path for each scope and config file.
*/
export function buildPointerFieldEdits(
    session: Session,
    generated: GeneratedFile[],
    configs: PlannedPointerField['configs'],
): ManagedKeys[] {
    const { root, repository, scopes } = session;
    const paths = new Set(generated.map(({ path }) => path));
    const scopePaths = scopes.map(({ path }) => path);
    const tools = listPointerFieldTools(session);
    const pointerTargets = tools.flatMap((selected) =>
        listPointerFieldTargets({ ...selected, paths, configs, scopePaths }),
    );
    const pointerFields = new Map(pointerTargets.map((row) => [JSON.stringify([row.key, row.scope, row.target]), row]));
    if (pointerFields.size === 0) return [];
    const packages = new Set([
        PACKAGE_JSON,
        ...repository.files
            .filter((file) => file.kind === 'source' && posix.basename(file.path) === PACKAGE_JSON)
            .map(({ path }) => path),
    ]);
    const files = openFiles(root);
    const edits: ManagedKeys[] = [];
    for (const path of packages) {
        const source = files.read(path);
        if (source === undefined) continue;
        const document = tryParseFile(() => parseJsonFile(path, source.bytes.toString('utf8')));
        if (document === undefined) continue;
        const keys = pointerFields
            .values()
            .map((row) => ({ ...row, extends: buildModuleSpecifier(path, row.target) }))
            .filter(
                (row) =>
                    Object.hasOwn(document, row.key) &&
                    isInScope(path, row.scope) &&
                    isOutsideChildScopes(path, row.children) &&
                    (paths.has(row.target) || isDeepStrictEqual(document[row.key], { extends: row.extends })),
            )
            .map((row) => ({
                key: [row.key],
                value: paths.has(row.target) ? { extends: row.extends } : undefined,
            }))
            .toArray();
        if (keys.length > 0) edits.push({ path, keys });
    }
    return edits;
}

/**
Build the pointer files of one generated config file. A pointer file with overrides sits at the root. For the files of each scope,
it extends the config file of that scope. Parents come first, so the config of a nested scope wins.

@param owner the repository and the scope.
@param config the shipped config file.
@param targets the config file path of each scope that writes it; other pointer files read the path of the owner's scope.
*/
export function buildPointerFiles(
    owner: ConfigOwner,
    config: Config,
    targets: ReadonlyMap<string, string>,
): GeneratedFile[] {
    const { pointer } = config;
    if (pointer === undefined) return [];
    return listPointerPaths(owner, config).map((path) => {
        const body = fillTarget(pointer.body, path, getRequired(targets, owner.scope.path, 'pointer target')).replace(
            OVERRIDES_PLACEHOLDER,
            () =>
                JSON.stringify(
                    [...targets]
                        .toSorted(([left], [right]) => compareText(left, right))
                        .map(([scope, target]) => ({
                            files: [scope === '' ? '**' : `${escapeGlob(scope)}/**`],
                            extends: buildModuleSpecifier(path, target),
                        })),
                ),
        );
        return { path, content: `${formatHeader(path, pointer.note === undefined ? [] : [pointer.note])}${body}` };
    });
}
