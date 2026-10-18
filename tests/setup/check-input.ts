// Builds check inputs for tests and keeps compiler state in a temporary folder.
import { spyOn } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { buildCheckRun } from '#cli/runs/run.ts';
import { checkInput } from '#cli/runs/built-in.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { type Session } from '#cli/types/planning.ts';
import * as environment from '#cli/system/environment.ts';
import { normalizeOutputPath } from '#cli/system/paths.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';
import { SWIFT_PACKAGE } from '#tests/data/checks/swift/package.ts';
import { selectCheckImplementation } from '#cli/checks/implementations.ts';
import { testdir, createFileTree, type DirectoryJSON, type TestdirResult } from 'testdirs';

/**
 * Keep compiler state in a temporary folder until the test ends.
 * @returns a stack that removes the folder and the spy.
 */
async function createCompilerCache(): Promise<AsyncDisposableStack> {
    await using resources = new AsyncDisposableStack();
    const cache = resources.use(await testdir());
    resources.use(spyOn(environment, 'readCacheFolder').mockReturnValue(cache.path));
    return resources.move();
}

/**
 * Build the input of one check, with its files and the full file list of the repository.
 * @param session the sandbox the test opened.
 * @param checkId for example bash/shellcheck.
 * @param options which files to include and what to clean up.
 * @param options.scope a folder to check; the root by default.
 * @param options.paths files to check; every file by default.
 * @param options.resources what to dispose of with the check.
 * @returns the files and settings that the check reads.
 */
function buildCheckInput(
    session: Session,
    checkId: string,
    options: { scope?: string; paths?: string[]; resources?: DisposableStack } = {},
): CheckInput {
    const path = normalizeOutputPath(options.scope ?? '');
    const scope = session.scopes.find((entry) => entry.scope.path === path);
    if (scope === undefined) throw new Error(`The sandbox has no scope at ${path || 'the root'}.`);
    const check = scope.selected.flatMap((manifest) => manifest.checks).find((entry) => entry.name === checkId);
    if (check === undefined) throw new Error(`The sandbox selects no check called ${checkId}.`);
    const paths = options.paths?.map((source) => normalizeOutputPath(source));
    const files = session.repository.files.filter(
        (file) =>
            (check.runs === 'once' || findScope(file.path, session.repository.scopes).path === path) &&
            (paths === undefined || paths.includes(file.path)),
    );
    return {
        ...checkInput(session, { selection: scope, check, files }),
        repositoryFiles: session.repository.files,
        ...(options.resources === undefined ? {} : { resources: options.resources }),
    };
}

/**
 * Create a Swift sandbox and build the input of one check. The input uses fake tool versions and a temporary compiler cache.
 * @param sandbox folder that the test removes.
 * @param checkId for example swift/swiftlint.
 * @param files paths and text to add or replace.
 * @returns the input, the session, and what to dispose.
 */
async function prepareSwiftInput(
    sandbox: TestdirResult,
    checkId: string,
    files: DirectoryJSON = {},
): Promise<{ input: CheckInput; session: Session; resources: AsyncDisposableStack }> {
    await using resources = new AsyncDisposableStack();
    resources.use(spyOn(environment, 'getOperatingSystem').mockReturnValue('macos'));
    resources.use(
        fakePinnedExecutables(
            [...readManifests(createReadCache(process.cwd())).values()].flatMap((manifest) => manifest.tools),
        ),
    );
    resources.use(await createCompilerCache());
    await createFileTree(sandbox.path, {
        'Package.swift': SWIFT_PACKAGE,
        'gspot.toml': buildSettingsText(['swift']),
        ...files,
    });
    const session = await openSession(sandbox.path);
    return { session, input: buildCheckInput(session, checkId), resources: resources.move() };
}

/** Open the sandbox, run one built-in check, and return its findings. */
async function checkFindings(
    root: string,
    checkId: string,
    options: { scope?: string; paths?: string[]; resources?: DisposableStack } = {},
): Promise<readonly Finding[]> {
    using resources = new DisposableStack();
    const session = await openSession(root);
    resources.use(session.resources);
    const input = buildCheckInput(session, checkId, { ...options, resources: options.resources ?? resources });
    const planned = session.configuredChecks.find(
        (entry) => entry.check.name === checkId && entry.selection.scope.path === input.selection.scope.path,
    );
    if (planned === undefined)
        throw new Error(`The sandbox does not plan ${checkId} in ${input.selection.scope.path || 'the root'}.`);
    const result = await buildCheckRun(selectCheckImplementation(input.check))(
        { ...session, resources: options.resources ?? resources },
        { ...planned, files: input.files },
    );
    return result.findings;
}

/** Open a session with fake pinned versions of these tools. */
async function openPinnedSession(
    root: string,
    toolNames: string[],
    resources: Pick<DisposableStack, 'use'>,
): Promise<Session> {
    const session = await openSession(root);
    resources.use(fakePinnedExecutables(toolNames.map((name) => getToolDeclaration(session.manifests.values(), name))));
    return session;
}

export { checkFindings, buildCheckInput, openPinnedSession, prepareSwiftInput, createCompilerCache };
