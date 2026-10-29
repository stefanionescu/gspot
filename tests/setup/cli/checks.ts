import { spyOn } from 'bun:test';
import { CHECK_CODE } from '#cli/checks/registry.ts';
import { type Session } from '#cli/types/session.ts';
import { openSession } from '#cli/planning/session.ts';
import { runBuiltInCheck } from '#cli/runs/results.ts';
import { ROOT_LABEL } from '#tests/config/messages.ts';
import { SWIFT_PACKAGE } from '#tests/config/swift.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import * as environment from '#cli/system/environment.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { getTool, getToolName } from '#cli/configurations/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { checkGeneratorOutputs } from '#cli/checks/generator-outputs.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { runCheckCode, buildCheckSession } from '#cli/commands/check/run.ts';
import { testdir, createFileTree, type DirectoryJSON, type TestdirResult } from 'testdirs';

/**
Keep the compiler cache in a temporary folder until the test ends.
*/
export async function redirectCacheFolder(): Promise<AsyncDisposableStack> {
    await using resources = new AsyncDisposableStack();
    const cache = resources.use(await testdir());
    resources.use(overrideEnvironment({ XDG_CACHE_HOME: cache.path }));
    return resources.move();
}

/**
Plan one sandbox check with its complete repository and selected scope files.
*/
export function planSandboxCheck(
    session: Session,
    checkId: string,
    options: { scope?: string; paths?: string[] } = {},
): PlannedCheck {
    const path = options.scope ?? '';
    const scope = session.scopes.find((each) => each.path === path);
    if (scope === undefined) throw new Error(`The sandbox has no scope at ${path || ROOT_LABEL}.`);
    const selected = scope.configurations
        .flatMap((configuration) => configuration.checks.map((check) => ({ configuration, check })))
        .find(({ check }) => check.id === checkId);
    if (selected === undefined) throw new Error(`The sandbox selects no check called ${checkId}.`);
    const { configuration, check } = selected;
    const paths = options.paths;
    const files = session.repository.files.filter(
        (file) =>
            (check.runs === 'once' || selectScopePath(file.path, session.repository.scopeFolders) === path) &&
            (paths === undefined || paths.includes(file.path)),
    );
    const tool = getToolName(check);
    return {
        scope,
        configuration,
        check,
        files,
        triggerPaths: [],
        ...(tool !== undefined && { tool: getTool(session.configurationsByName.values(), tool) }),
    };
}

/**
Create a Swift sandbox with fake tool versions and a temporary compiler cache. The test removes the sandbox folder.
*/
export async function prepareSwiftCheck(
    sandbox: TestdirResult,
    checkId: string,
    files: DirectoryJSON = {},
): Promise<AsyncDisposable & { session: Session; planned: PlannedCheck }> {
    await using resources = new AsyncDisposableStack();
    resources.use(spyOn(environment, 'getOperatingSystem').mockReturnValue('macos'));
    resources.use(
        fakeToolExecutables(
            readConfigurations()
                .values()
                .flatMap((configuration) => configuration.tools)
                .toArray(),
        ),
    );
    resources.use(await redirectCacheFolder());
    await createFileTree(sandbox.path, {
        'Package.swift': SWIFT_PACKAGE,
        'gspot.toml': buildSandboxSettings(['swift']),
        ...files,
    });
    const session = await openSession(sandbox.path, { resources: resources.use(new DisposableStack()) });
    return Object.assign(resources.move(), { session, planned: planSandboxCheck(session, checkId) });
}

/**
Open the sandbox, run one built-in check, and return its findings.
*/
export async function runSandboxCheck(
    root: string,
    checkId: string,
    options: { scope?: string; paths?: string[] } = {},
): Promise<readonly Finding[]> {
    using resources = new DisposableStack();
    const session = await openSession(root, { resources });
    const planned = planSandboxCheck(session, checkId, options);
    const result = await runCheckCode(
        buildCheckSession(session),
        planned,
        planned.check.generator_outputs === undefined ? CHECK_CODE[planned.check.id] : { check: checkGeneratorOutputs },
    );
    return result.findings;
}

/**
Open a session with fake pinned versions of these tools.
*/
export async function openFakeToolSession(
    root: string,
    toolNames: string[],
    resources: Pick<DisposableStack, 'use'>,
): Promise<Session> {
    const session = await openSession(root);
    resources.use(fakeToolExecutables(toolNames.map((name) => getTool(session.configurationsByName.values(), name))));
    return session;
}

/**
Find the code of a built-in check, as a function that resolves to its findings.
*/
export function getBuiltInCheck(checkId: string): (session: Session, planned: PlannedCheck) => Promise<Finding[]> {
    const check = CHECK_CODE[checkId]?.check;
    if (check === undefined) throw new Error(`${checkId} has no built-in check.`);
    return async (session, planned) => {
        const result = await runBuiltInCheck(check, buildCheckSession(session), planned);
        return [...result.findings];
    };
}
