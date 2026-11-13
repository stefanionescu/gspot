import { GITHUB_WORKFLOW, GITLAB_WORKFLOW } from '#cli/config/generation/builders.ts';
import { listOwnedConfigs } from '#cli/generation/configs/owned.ts';
import { isPointerInherited, listPointerPaths } from '#cli/generation/configs/pointers.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { isGspotPath } from '#cli/repository/files/ownership.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { compareText } from '#cli/system/text/order.ts';
import type { ConfigTargets } from '#cli/types/engine/tool-runs.ts';
import type { Config } from '#cli/types/manifests.ts';
import type { Session } from '#cli/types/tools.ts';

/**
List the place where gspot writes a config from a source, when that place is outside the gspot folder.
*/
function listOutsideTargets(scopePath: string, config: Config): string[] {
    if (config.source === undefined || isGspotPath(config.target)) return [];
    return [config.per_scope ? joinScope(scopePath, config.target) : config.target];
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
        ...listOutsideTargets(owner.scope.path, config),
        ...listPointerPaths(owner, config),
    ]);
    return new Set([GITHUB_WORKFLOW, GITLAB_WORKFLOW, ...paths]);
}

/**
List the configs and pointer files that gspot writes outside its folder, without the CI workflow.
*/
export function listWrittenPaths(session: Session, generated: Pick<ConfigTargets, 'targets'>): string[] {
    const paths = listOwnedConfigs(session).flatMap((owned) => {
        const { config, owner } = owned;
        return [
            ...listOutsideTargets(owner.scope.path, config),
            ...(isPointerInherited(owned, generated) ? [] : listPointerPaths(owner, config)),
        ];
    });
    return [...new Set(paths)].toSorted(compareText);
}
