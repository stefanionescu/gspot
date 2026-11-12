import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import {
    GITHUB_WORKFLOW,
    GITLAB_WORKFLOW,
    OVERRIDES_PLACEHOLDER,
    TARGET_MODULE_PLACEHOLDER,
    TARGET_PLACEHOLDER,
} from '#cli/config/generation/files.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { getConfigTarget } from '#cli/engine/tool-runs/placeholders.ts';
import { listCheckTools } from '#cli/engine/tools.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import { isOutsideChildScopes, joinScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { tryParseFile } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import {
    buildModuleSpecifier,
    escapeGlob,
    extractParentFolder,
    findOutermostFolder,
    isInScope,
} from '#cli/system/paths.ts';
import { getRequired } from '#cli/system/tables.ts';
import { compareText } from '#cli/system/text.ts';
import type { ConfigOwner } from '#cli/types/configurations/language.ts';
import type { PlannedPointerField } from '#cli/types/generation.ts';
import type { Config } from '#cli/types/manifests.ts';
import type { ManagedKeys } from '#cli/types/repository.ts';
import type { GeneratedFile, Session } from '#cli/types/tools.ts';

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
    scopePath: string,
    scopePaths: PlannedPointerField['scopePaths'],
): { scopePath: string; children: string[]; target: string } {
    const pointerScopePath = file.per_scope ? scopePath : '';
    const children = file.per_scope ? listNestedScopes(scopePaths, pointerScopePath) : [];
    const pointerPath =
        file.pointer === undefined || (pointerScopePath !== '' && file.pointer.overrides === true)
            ? target
            : joinScope(pointerScopePath, file.pointer.path);
    return { scopePath: pointerScopePath, children, target: pointerPath };
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
    const owned = listCoveredFiles(configuration.files, repository.files, { ...scope, path: '' }).filter(
        (file) => isInScope(file.path, scopePath) && isOutsideChildScopes(file.path, children),
    );
    const folders = new Set(
        owned.flatMap(({ path }) => {
            const folder = findOutermostFolder(extractParentFolder(path), isMatch);
            if (folder === undefined) return [];
            return [isInScope(folder, scopePath) ? folder : scopePath];
        }),
    );
    return [...folders].map((folder) => `${folder}/${pointer.path}`);
}

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
    const pointerFields = new Map(
        pointerTargets.map((row) => [JSON.stringify([row.key, row.scopePath, row.target]), row]),
    );
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
                    isInScope(path, row.scopePath) &&
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
                        .map(([scopePath, target]) => ({
                            files: [scopePath === '' ? '**' : `${escapeGlob(scopePath)}/**`],
                            extends: buildModuleSpecifier(path, target),
                        })),
                ),
        );
        return { path, content: `${formatHeader(path, pointer.note === undefined ? [] : [pointer.note])}${body}` };
    });
}
