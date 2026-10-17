// Builds check inputs for tests and keeps compiler state in a temporary folder.
import { spyOn } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { type Session } from '#cli/types/planning.ts';
import * as environment from '#cli/system/environment.ts';
import { normalizeOutputPath } from '#cli/system/paths.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { fakePinnedExecutables } from '#tests/setup/fakes.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { SWIFT_PACKAGE } from '#tests/data/checks/swift/package.ts';
import { CHECK_IMPLEMENTATIONS } from '#cli/checks/implementations.ts';
import { checkInput, runBuiltInCheck } from '#cli/checks/run/built-in.ts';
import { checkStaleGeneratorOutputs } from '#cli/checks/stale-generator-outputs.ts';
import { testdir, createFileTree, type DirectoryJSON, type TestdirResult } from 'testdirs';
import type { Finding, CheckInput, RunnableCheck, CheckImplementations } from '#cli/types/checks/run/check.ts';

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
 * @param options.scope the scope path; the root by default.
 * @param options.paths files to check; every file by default.
 * @param options.resources what to dispose of with the check.
 * @returns the check input.
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
        ...checkInput(session, { scope, check, files }),
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
        (entry) => entry.check.name === checkId && entry.scope.scope.path === input.scope.scope.path,
    );
    if (planned === undefined)
        throw new Error(`The sandbox does not plan ${checkId} in ${input.scope.scope.path || 'the root'}.`);
    const implementations: CheckImplementations = CHECK_IMPLEMENTATIONS;
    const implementation = implementations[checkId];
    const run = selectCheckRunner(input, implementation);
    const result = await run(
        { ...session, resources: options.resources ?? resources },
        { ...planned, files: input.files },
    );
    return result.findings;
}

/** Pick the check implementation to run, including the stale generator output check. */
function selectCheckRunner(
    input: CheckInput,
    implementation: CheckImplementations[string] | undefined,
): RunnableCheck['run'] {
    if (input.check.generator_outputs !== undefined) return runBuiltInCheck(checkStaleGeneratorOutputs);
    if (implementation?.check === undefined)
        return (implementation as Extract<CheckImplementations[string], { run: unknown }>).run;
    return runBuiltInCheck(implementation.check);
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
