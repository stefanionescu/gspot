// Installs the locked dependencies of each project in CI, so the checks that read them find them.
import { quoteArgument } from '#cli/system/text.ts';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import type { Session } from '#cli/types/planning.ts';
import { isYarnBerry } from '#cli/repository/package-manager.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { PROJECT_UV_LOCKFILE } from '#cli/config/system/locations.ts';

import {
    FROZEN_INSTALLS,
    NEXT_TYPEGEN_LINE,
    YARN_BERRY_INSTALL,
    NEXTJS_CONFIGURATION,
} from '#cli/config/generation/ci.ts';

// uv runs at the version that the gspot tools pin, through mise, which every CI job of gspot has.
function buildFrozenInstall(session: Session, lockfile: string): readonly string[] | undefined {
    if (lockfile === PROJECT_UV_LOCKFILE) {
        const { version } = getToolDeclaration(session.manifests.values(), UV_TOOL);
        if (version === undefined) throw new Error('The uv tool declaration has no pinned version.');
        return ['mise', 'exec', `${UV_TOOL}@${version}`, '--', ...(FROZEN_INSTALLS[lockfile] ?? [])];
    }
    const declared = session.getPackageManager();
    if (lockfile === 'yarn.lock' && declared !== undefined && isYarnBerry(declared)) return [...YARN_BERRY_INSTALL];
    return FROZEN_INSTALLS[lockfile];
}

/**
 * List the shell lines that install the locked dependencies of each project, then write the route types of each
 * Next.js project, which typed lint rules read.
 * @param session the repository, its scopes, and its tools.
 * @returns the lines, each run from the repository root.
 */
export function listProjectInstallLines(session: Session): string[] {
    const tracked = new Set(session.repository.files.map((file) => file.path));
    return session.scopes.flatMap(({ scope, selected }) => {
        const installs = Object.keys(FROZEN_INSTALLS)
            .filter((lockfile) => tracked.has(joinScope(scope.path, lockfile)))
            .flatMap((lockfile) => {
                const command = buildFrozenInstall(session, lockfile);
                return command === undefined ? [] : [command.map((argument) => quoteArgument(argument)).join(' ')];
            });
        const isNext = selected.some((manifest) => manifest.configuration.name === NEXTJS_CONFIGURATION);
        const lines = [...installs, ...(isNext && installs.length > 0 ? [NEXT_TYPEGEN_LINE] : [])];
        return scope.path === '' ? lines : lines.map((line) => `(cd ${quoteArgument(scope.path)} && ${line})`);
    });
}
