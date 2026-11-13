import semver from 'semver';

import { JAVASCRIPT_LOCKFILES, PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { LINT_PACKAGE, OVERLAPPING_TOOLS } from '#cli/config/repository/setup.ts';
import { NODE_PROGRAM, OPERATING_SYSTEMS, UV_PROGRAM } from '#cli/config/system.ts';
import { TYPESCRIPT_ESLINT_TOOL, TYPESCRIPT_PACKAGE } from '#cli/config/tools/programs.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { findTool, getTool, listDistinctTools } from '#cli/manifests/tools.ts';
import { readLockedVersions } from '#cli/parsers/projects/lockfiles.ts';
import { listTrackedPaths } from '#cli/repository/files/tracked.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { compareText } from '#cli/system/text/order.ts';
import type { Configuration, Tool } from '#cli/types/manifests.ts';
import type { LintCommandSearch } from '#cli/types/repository.ts';
import type { Host, MiseToolPin, PackagePin, PackagePins, Session, SessionBase } from '#cli/types/tools.ts';

/**
Read the TypeScript version that the tracked root lockfile resolves. An untracked lockfile does not count, so every
clone reads the same version.
*/
function readLockedTypescript(session: Pick<SessionBase, 'cache' | 'repository'>): string | undefined {
    const { cache, repository } = session;
    const tracked = new Set(listTrackedPaths(repository));
    const lockfile = JAVASCRIPT_LOCKFILES.find((name) => findText(cache, name) !== undefined);
    if (lockfile === undefined || !tracked.has(lockfile)) return undefined;
    return semver.valid(readLockedVersions(cache, '')?.get(TYPESCRIPT_PACKAGE)) ?? undefined;
}

function readProjectTypescript(session: Pick<SessionBase, 'cache' | 'repository'>): string | undefined {
    const root = session.repository.dependencyFiles.find(({ path }) => path === PACKAGE_JSON);
    const specifier = root?.installed[TYPESCRIPT_PACKAGE];
    if (specifier === undefined) return undefined;
    return semver.valid(specifier) ?? readLockedTypescript(session);
}

export function listMisePins(configurations: Configuration[]): MiseToolPin[] {
    const tools = listDistinctTools(configurations);
    const pins = tools.flatMap((tool) => findMisePin(tool) ?? []);
    if (
        tools.some((tool) => findPackagePin(tool)?.kind === 'python') &&
        tools.every((tool) => tool.name !== UV_PROGRAM)
    )
        pins.push(getUvPin());
    return pins;
}

export function getUvPin(): MiseToolPin {
    const pin = findMisePin(getTool(readConfigurations().values(), UV_PROGRAM));
    if (pin === undefined) throw new Error('The uv manifest has no mise pin.');
    return pin;
}

export function findMisePin(tool: Tool): MiseToolPin | undefined {
    if (tool.system === true || findPackagePin(tool) !== undefined) return undefined;
    return tool.installers.mise;
}

export function listPackagePins(configurations: Configuration[]): PackagePins {
    const npm: Array<[string, string]> = [];
    const python: string[] = [];
    for (const tool of listDistinctTools(configurations)) {
        const installation = findPackagePin(tool);
        if (installation === undefined) continue;
        if (installation.kind === 'npm') npm.push([installation.name, installation.version]);
        else python.push(`${installation.name}==${installation.version}`);
    }
    return {
        npm: Object.fromEntries(npm.toSorted(([first], [second]) => compareText(first, second))),
        python,
    };
}

export function listNpmProjectPins(session: Pick<Session, 'scopes' | 'toolConfigurations'>): PackagePins['npm'] {
    const plugins = session.scopes.flatMap(({ settings }) => [
        ...(settings.tables['tools.eslint']?.plugins ?? []),
        ...(settings.tables['tools.stylelint']?.plugins ?? []),
    ]);
    const pluginPins = plugins.flatMap(({ package: name, version }) =>
        name === undefined ? [] : [[name, version as string] as const],
    );
    const pinsByName = Map.groupBy(pluginPins, ([name]) => name);
    for (const [name, pins] of pinsByName)
        if (new Set(pins.map(([, version]) => version)).size > 1)
            throw new GspotError('settings', `The plugin records name ${name} at two versions. Use one version.`);
    return { ...Object.fromEntries(pluginPins), ...listPackagePins(session.toolConfigurations).npm };
}

export function listReplacedTools(configurations: Configuration[]): Pick<LintCommandSearch, 'tools' | 'pins'> {
    const replaced = listDistinctTools(configurations).filter(
        ({ replace, replace_key }) => replace !== undefined || replace_key !== undefined,
    );
    const names = new Set(replaced.map(({ name }) => name));
    const covered = OVERLAPPING_TOOLS.filter(({ owner }) => names.has(owner)).map(({ name }) => name);
    const stack = configurations.map((configuration) => ({
        ...configuration,
        tools: configuration.tools.filter(
            ({ name, kind }) => names.has(name) || (kind === 'package' && LINT_PACKAGE.test(name)),
        ),
    }));
    return { tools: new Set([...names, ...covered]), pins: listPackagePins(stack).npm };
}

export function findPackagePin(tool: Tool): PackagePin | undefined {
    const python = tool.installers.pypi;
    if (python !== undefined && tool.system !== true)
        return { kind: 'python', name: python.name, version: python.version };
    const npm = tool.installers['npm'];
    if (npm?.version === undefined) return undefined;
    return {
        kind: 'npm',
        name: npm.name,
        version: npm.version,
        requires: [[NODE_PROGRAM], tool.requires].flatMap((peers) => peers ?? []),
    };
}

export function findMissingBuild(tool: Tool, host: Host): string | undefined {
    if (tool.builds === undefined) return undefined;
    const { platform } = host;
    const named: readonly string[] = tool.builds;
    return named.includes(platform)
        ? undefined
        : (OPERATING_SYSTEMS.find((system) => system.name === platform)?.label ?? platform);
}

/**
Pin the TypeScript of the tool project to the version that the root package.json declares, when typescript-eslint
supports that version, so that type-aware ESLint reads the project with the compiler that builds it. Otherwise the
shipped pin stays. The tool project, its lockfile, doctor, and the TypeScript checks all read this pin.
*/
export function pinProjectTypescript(
    configurations: Configuration[],
    session: Pick<SessionBase, 'cache' | 'repository'>,
): Configuration[] {
    const range = findTool(configurations, TYPESCRIPT_ESLINT_TOOL)?.peers?.[TYPESCRIPT_PACKAGE];
    const version = range === undefined ? undefined : readProjectTypescript(session);
    if (range === undefined || version === undefined || !semver.satisfies(version, range)) return configurations;
    return configurations.map((configuration) => ({
        ...configuration,
        tools: configuration.tools.map((tool) => {
            const npm = tool.installers['npm'];
            return npm?.name === TYPESCRIPT_PACKAGE
                ? { ...tool, version, installers: { ...tool.installers, npm: { ...npm, version } } }
                : tool;
        }),
    }));
}
