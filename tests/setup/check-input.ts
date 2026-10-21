// Builds check inputs for tests and keeps compiler state in a temporary folder.
import { spyOn } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { findCheckCode } from '#cli/checks/code.ts';
import { type Session } from '#cli/types/session.ts';
import { findScope } from '#cli/repository/scopes.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { runCheckCode } from '#cli/commands/check/run.ts';
import * as environment from '#cli/system/environment.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { simulateOperatingSystem } from '#tests/setup/system.ts';
import { SWIFT_PACKAGE } from '#tests/data/checks/swift/package.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { getTool, getToolName } from '#cli/configurations/declared-tools.ts';
import { testdir, createFileTree, type DirectoryJSON, type TestdirResult } from 'testdirs';

/**
 * Keep compiler state in a temporary folder until the test ends.
 *
 * @returns a stack that removes the folder and the spy.
 */
export async function createCompilerCache(): Promise<AsyncDisposableStack> {
    await using resources = new AsyncDisposableStack();
    const cache = resources.use(await testdir());
    resources.use(spyOn(environment, 'readCacheFolder').mockReturnValue(cache.path));
    return resources.move();
}

/**
 * Plan one sandbox check with its complete repository and selected scope files.
 *
 * @param session the sandbox the test opened.
 * @param checkId for example bash/shellcheck.
 * @param options which files to include and what to clean up.
 * @param options.scope a folder to check; the root by default.
 * @param options.paths files to check; every file by default.
 * @returns the files and settings that the check reads.
 */
export function planSandboxCheck(
    session: Session,
    checkId: string,
    options: { scope?: string; paths?: string[] } = {},
): PlannedCheck {
    const path = options.scope ?? '';
    const scope = session.scopes.find((entry) => entry.scope.path === path);
    if (scope === undefined) throw new Error(`The sandbox has no scope at ${path || 'the root'}.`);
    const entry = scope.selected
        .flatMap((configuration) => configuration.checks.map((check) => ({ configuration, check })))
        .find(({ check }) => check.name === checkId);
    if (entry === undefined) throw new Error(`The sandbox selects no check called ${checkId}.`);
    const { configuration, check } = entry;
    const paths = options.paths;
    const files = session.repository.files.filter(
        (file) =>
            (check.runs === 'once' || findScope(file.path, session.repository.scopeFolders).path === path) &&
            (paths === undefined || paths.includes(file.path)),
    );
    const tool = getToolName(check);
    return {
        selection: scope,
        configuration,
        check,
        files,
        triggerPaths: [],
        ...(tool === undefined ? {} : { tool: getTool(session.configurations.values(), tool) }),
    };
}

/**
 * Create a Swift sandbox with fake tool versions and a temporary compiler cache.
 *
 * @param sandbox folder that the test removes.
 * @param checkId for example swift/swiftlint.
 * @param files paths and text to add or replace.
 * @returns the session, planned check, and their cleanup.
 */
export async function prepareSwiftCheck(
    sandbox: TestdirResult,
    checkId: string,
    files: DirectoryJSON = {},
): Promise<AsyncDisposable & { session: Session; planned: PlannedCheck }> {
    await using resources = new AsyncDisposableStack();
    resources.use(simulateOperatingSystem('darwin'));
    resources.use(
        fakePinnedExecutables([...readConfigurations().values()].flatMap((configuration) => configuration.tools)),
    );
    resources.use(await createCompilerCache());
    await createFileTree(sandbox.path, {
        'Package.swift': SWIFT_PACKAGE,
        'gspot.toml': buildSandboxSettings(['swift']),
        ...files,
    });
    const session = await openSession(sandbox.path, { resources: resources.use(new DisposableStack()) });
    return Object.assign(resources.move(), { session, planned: planSandboxCheck(session, checkId) });
}

/** Open the sandbox, run one built-in check, and return its findings. */
export async function checkFindings(
    root: string,
    checkId: string,
    options: { scope?: string; paths?: string[]; resources?: DisposableStack } = {},
): Promise<readonly Finding[]> {
    using resources = new DisposableStack();
    const session = await openSession(root, { resources: options.resources ?? resources });
    const planned = planSandboxCheck(session, checkId, options);
    const result = await runCheckCode(session, planned, findCheckCode(planned.check));
    return result.findings;
}

/** Open a session with fake pinned versions of these tools. */
export async function openPinnedSession(
    root: string,
    toolNames: string[],
    resources: Pick<DisposableStack, 'use'>,
): Promise<Session> {
    const session = await openSession(root);
    resources.use(fakePinnedExecutables(toolNames.map((name) => getTool(session.configurations.values(), name))));
    return session;
}

/**
 * Find the code of a built-in check, as a function that resolves to its findings.
 *
 * @param checkId a check with built-in code, such as `structure/lone-files`.
 * @returns a function that runs the planned check in its session and resolves to its findings.
 */
export function findBuiltInCheck(checkId: string): (session: Session, planned: PlannedCheck) => Promise<Finding[]> {
    const check = findCheckCode({ name: checkId })?.check;
    if (check === undefined) throw new Error(`${checkId} has no built-in check.`);
    return async (session, planned) => {
        const result = await check(session, planned);
        return Array.isArray(result) ? result : result.findings;
    };
}
