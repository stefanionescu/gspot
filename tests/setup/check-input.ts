// Opens the selected check input and owns temporary compiler resources for tests.
import { spyOn } from 'bun:test';
import { findScope } from '#cli/repository/scopes.ts';
import { type Session } from '#cli/types/planning.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CHECK_FUNCTIONS } from '#cli/checks/built-in.ts';
import * as environment from '#cli/system/environment.ts';
import { normalizeOutputPath } from '#cli/system/paths.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { mockPinnedExecutables } from '#tests/setup/pins.ts';
import { SWIFT_PACKAGE } from '#tests/config/swift/package.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { checkInput, runBuiltInCheck } from '#cli/execution/built-in.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { testdir, createFileTree, type DirectoryJSON, type TestdirResult } from 'testdirs';

/**
 * Keep compiler state in a test-owned folder and restore the cache boundary when the test ends.
 * @returns the disposable temporary directory and boundary spy.
 */
export async function isolateCompilerCache(): Promise<AsyncDisposableStack> {
    await using resources = new AsyncDisposableStack();
    const cache = resources.use(await testdir());
    resources.use(spyOn(environment, 'readCacheFolder').mockReturnValue(cache.path));
    return resources.move();
}

/**
 * Select one check and its source files while retaining the repository inventory for references.
 * @param session the authored settings and inventory opened by the test.
 * @param checkId the selected check ID.
 * @param options the scope, source paths, and resources owned by the test.
 * @param options.scope the scope path.
 * @param options.paths the selected source paths.
 * @param options.resources the resources owned by this check.
 * @returns the check input.
 */
export function buildCheckInput(
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
 * Prepare one Swift check with test-owned compiler state and executable versions.
 * @param sandbox the directory disposed by the owning test.
 * @param checkId the selected check.
 * @param files the test's source and authored settings overrides.
 * @returns the opened input and session, with their preparation resources.
 */
export async function swiftBuildInput(
    sandbox: TestdirResult,
    checkId: string,
    files: DirectoryJSON = {},
): Promise<{ input: CheckInput; session: Session; resources: AsyncDisposableStack }> {
    await using resources = new AsyncDisposableStack();
    resources.use(spyOn(environment, 'getOperatingSystem').mockReturnValue('macos'));
    resources.use(
        mockPinnedExecutables(
            [...readManifests(createReadCache(process.cwd())).values()].flatMap((manifest) => manifest.tools),
        ),
    );
    resources.use(await isolateCompilerCache());
    await createFileTree(sandbox.path, {
        'Package.swift': SWIFT_PACKAGE,
        'gspot.toml': settingsText(['swift']),
        ...files,
    });
    const session = await openSession(sandbox.path);
    return { session, input: buildCheckInput(session, checkId), resources: resources.move() };
}

/** Open the sandbox and run the selected built-in check with its actual input. */
export async function checkFindings(
    root: string,
    checkId: keyof typeof CHECK_FUNCTIONS,
    options: { scope?: string; paths?: string[]; resources?: DisposableStack } = {},
): Promise<readonly Finding[]> {
    using resources = new DisposableStack();
    const session = await openSession(root);
    resources.use(session.resources);
    const input = buildCheckInput(session, checkId, { ...options, resources: options.resources ?? resources });
    const planned = session.configuredChecks.find(
        (entry) => entry.check.name === checkId && entry.scope.scope.path === input.selection.scope.path,
    );
    if (planned === undefined)
        throw new Error(`The sandbox does not plan ${checkId} in ${input.selection.scope.path || 'the root'}.`);
    const result = await runBuiltInCheck(CHECK_FUNCTIONS[checkId])(
        { ...session, resources: options.resources ?? resources },
        { ...planned, files: input.files },
    );
    return result.findings;
}
