import { PYPROJECT_TOML } from '#cli/config/parsers/projects.ts';
import { GSPOT_PACKAGES } from '#cli/config/repository/version-pin.ts';
import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import {
    CANCELED_CHECK_NOTE,
    DOCKER_DAEMON_NOTE,
    DOCKER_MISSING_MESSAGE,
    DOCKER_TOOL,
    PROJECT_DEPENDENCIES_MESSAGE,
    PROJECT_ENVIRONMENT_MESSAGE,
    ROOT_FOLDER_NAME,
} from '#cli/config/tools/programs.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { remember } from '#cli/system/cache.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { listEnclosingFolders } from '#cli/system/paths.ts';
import { runProcess } from '#cli/system/processes/run.ts';
import { findToolPath } from '#cli/tools/programs/inspect.ts';
import { findActiveEnvironment } from '#cli/tools/python-environment.ts';
import type { ProcessFailure, ScopeCheck, Session, ToolLookupSession } from '#cli/types/tools.ts';

const DOCKER_AVAILABILITY = Symbol('docker availability');

function findProjectEnvironment(toolsRoot: string, scopePath: string): string | undefined {
    const active = findActiveEnvironment();
    if (active !== undefined) return active;
    const folder = joinScope(scopePath, PYTHON_ENVIRONMENT_FOLDER);
    const environment = openFiles(toolsRoot).findStats(folder);
    return environment?.isDirectory() === true || environment?.isSymbolicLink() === true ? folder : undefined;
}

export function findMissingEnvironment(
    session: Pick<Session, 'repository' | 'toolsRoot'>,
    planned: Pick<ScopeCheck, 'check' | 'scope'>,
): ProcessFailure | undefined {
    if (planned.check.needs?.includes('python-environment') !== true) return undefined;
    const scopePath = planned.scope.path;
    const project = joinScope(scopePath, PYPROJECT_TOML);
    if (session.repository.files.every((file) => file.path !== project)) return undefined;
    return findProjectEnvironment(session.toolsRoot, scopePath) === undefined
        ? { status: 'missing', note: PROJECT_ENVIRONMENT_MESSAGE }
        : undefined;
}

/**
Require the installed npm dependencies of the scope before a check whose types or imports come from them. Without
them, every imported type reads as any, and the typed rules report each use. The packages of gspot itself give the
project no types, so a scope that declares only them can run.
*/
export function findMissingDependencies(
    session: Pick<Session, 'repository' | 'toolsRoot'>,
    planned: Pick<ScopeCheck, 'check' | 'scope'>,
): ProcessFailure | undefined {
    if (planned.check.needs?.includes('dependencies') !== true) return undefined;
    const scopePath = planned.scope.path;
    const names = listProjectDependencyNames(session.repository.dependencyFiles, scopePath);
    if (names.every((name) => (GSPOT_PACKAGES as readonly string[]).includes(name))) return undefined;
    const files = openFiles(session.toolsRoot);
    const isInstalled = listEnclosingFolders(scopePath).some((folder) => {
        const modules = files.findStats(joinScope(folder, NODE_MODULES));
        return modules?.isDirectory() === true || modules?.isSymbolicLink() === true;
    });
    const folder = scopePath === '' ? ROOT_FOLDER_NAME : scopePath;
    return isInstalled
        ? undefined
        : { status: 'missing', note: PROJECT_DEPENDENCIES_MESSAGE.replace('{folder}', () => folder) };
}

export async function findMissingDocker(
    session: ToolLookupSession & Pick<Session, 'cache' | 'cancelSignal'>,
    planned: Pick<ScopeCheck, 'check'>,
): Promise<ProcessFailure | undefined> {
    if (planned.check.needs?.includes('docker') !== true) return undefined;
    const docker = await findToolPath(session, getTool(readConfigurations().values(), DOCKER_TOOL), session.root);
    if ('status' in docker) return { status: 'missing', note: DOCKER_MISSING_MESSAGE };
    const result = await remember(session.cache, DOCKER_AVAILABILITY, session.root, () =>
        runProcess([docker.path, 'info'], {
            cwd: session.root,
            timeoutSeconds: session.settings.tool_timeout_seconds,
            cancelSignal: session.cancelSignal,
        }),
    );
    if (result.end === 'canceled') return { status: 'canceled', note: CANCELED_CHECK_NOTE };
    return result.code === 0 ? undefined : { status: 'missing', note: DOCKER_DAEMON_NOTE };
}
