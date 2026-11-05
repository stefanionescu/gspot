import { spyOn } from 'bun:test';
import { createFileTree, type DirectoryJSON, testdir, type TestdirResult } from 'testdirs';

import { readNamingSettings } from '#cli/configurations/general/naming/checks/settings.ts';
import { CHECK_CODE, selectCheckCode } from '#cli/configurations/registry.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { runBuiltInCheck } from '#cli/engine/results.ts';
import { buildCheckSession, runCheckCode } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import * as environment from '#cli/system/environment.ts';
import { getTool } from '#cli/tools/pins.ts';
import type { NamingSettings } from '#cli/types/configurations/general.ts';
import type { PlannedCheck, RunSelection } from '#cli/types/engine/plan.ts';
import type { Finding } from '#cli/types/engine/tool-runs.ts';
import type { Session } from '#cli/types/tools.ts';
import { ROOT_LABEL, SWIFT_PACKAGE } from '#tests/config/setup/programs.ts';
import { CHECK_GENERATION, CHECK_RUN_OPTIONS, createRunResources } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { linkGrammars } from '#tests/setup/runner/run-folder.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { fakeToolExecutables } from '#tests/setup/system/fakes.ts';

/**
Keep the compiler cache in a temporary folder until the test ends.
*/
export async function redirectCacheFolder(): Promise<AsyncDisposableStack> {
    await using resources = new AsyncDisposableStack();
    const cache = resources.use(await testdir());
    await linkGrammars(cache.path);
    resources.use(overrideEnvironment({ XDG_CACHE_HOME: cache.path }));
    return resources.move();
}

/**
Plan one sandbox check with the product planner, and select the entry of its scope.
*/
export function planSandboxCheck(
    session: Session,
    checkId: string,
    options: { scope?: string; paths?: string[] } = {},
): PlannedCheck {
    const path = options.scope ?? '';
    const planned = planChecks(session, { stage: 'any', only: [checkId], paths: options.paths, keepLevelOff: true });
    const named = planned.find(({ scope }) => scope.path === path);
    const selected = options.scope === undefined ? (named ?? planned[0]) : named;
    if (selected === undefined)
        throw new Error(`The sandbox selects no check called ${checkId} at ${path || ROOT_LABEL}.`);
    return selected;
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
    const session = await openSession(sandbox.path, { resources: resources.use(createRunResources()) });
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
    using resources = createRunResources();
    const session = await openSession(root, { resources });
    const planned = planSandboxCheck(session, checkId, options);
    const result = await runCheckCode(
        buildCheckSession(session, CHECK_GENERATION),
        planned,
        selectCheckCode(planned.check),
        CHECK_RUN_OPTIONS,
    );
    return result.findings;
}

export async function openFakeToolSession(
    root: string,
    toolNames: string[],
    resources: Pick<DisposableStack, 'use'>,
): Promise<Session> {
    const session = await openSession(root, { resources: resources.use(createRunResources()) });
    resources.use(fakeToolExecutables(toolNames.map((name) => getTool(readConfigurations().values(), name))));
    return session;
}

export function getBuiltInCheck(
    checkId: string,
    selection?: RunSelection,
): (session: Session, planned: PlannedCheck) => Promise<Finding[]> {
    const check = CHECK_CODE[checkId]?.check;
    if (check === undefined) throw new Error(`${checkId} has no built-in check.`);
    return async (session, planned) => {
        const result = await runBuiltInCheck(
            check,
            buildCheckSession(session, CHECK_GENERATION, selection),
            planned,
            CHECK_RUN_OPTIONS,
        );
        return [...result.findings];
    };
}

/**
Read the naming settings that apply in one scope of this settings text.
*/
export async function buildScopeNamingSettings(text: string, scopePath = ''): Promise<NamingSettings> {
    await using sandbox = await createGitSandbox({
        'gspot.toml': text,
        ...(scopePath !== '' && { [`${scopePath}/.keep`]: '' }),
    });
    const session = await openSession(sandbox.path);
    const scope = session.scopes.find(({ path }) => path === scopePath);
    if (scope === undefined) throw new Error(`The settings declare no scope at ${scopePath}.`);
    return readNamingSettings(session.settings, scope);
}
