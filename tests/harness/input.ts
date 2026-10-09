// Build native check inputs and dispose their test-owned preparation resources.
import { openSession } from '#cli/commands/public.ts';
import { toolPath } from '#cli/platform/contracts.ts';
import type { Session } from '#cli/types/planning.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { checkInput } from '#cli/execution/contracts.ts';
import { scopeOf } from '#cli/repository/paths/contracts.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';
import { isolateCompilerCache } from '#tests/harness/environment.ts';
import { SWIFT_PACKAGE } from '#tests/config/samples/swift/source.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { BASE_CHECK } from '#tests/config/cli/execution/command/findings.ts';
import { createFileTree, type DirectoryJSON, type TestdirResult } from 'testdirs';
import type { SwiftBuildInput, CheckInputOptions } from '#tests/types/harness/input.ts';

/**
 * Select one check and its source files while retaining the repository inventory for references.
 * @param session the authored policy and inventory opened by the test
 * @param checkId the selected check ID
 * @param options the scope, source paths, and resources owned by the test
 * @returns the check input
 */
export function buildCheckInput(session: ToolSession, checkId: string, options: CheckInputOptions = {}): CheckInput {
    const path = toolPath(options.scope ?? '');
    const scope = session.scopes.find((entry) => entry.scope.path === path);
    if (scope === undefined) throw new Error(`The sandbox has no scope at ${path || 'the root'}.`);
    const check = scope.selected.flatMap((manifest) => manifest.checks).find((entry) => entry.name === checkId);
    if (check === undefined) throw new Error(`The sandbox selects no check called ${checkId}.`);
    const paths = options.paths?.map((source) => toolPath(source));
    const files = session.repository.files.filter(
        (file) =>
            (check.runs === 'once' || scopeOf(file.path, session.repository.scopes).path === path) &&
            (paths === undefined || paths.includes(file.path)),
    );
    return {
        ...checkInput(session, { scope, check, files }),
        repositoryFiles: session.repository.files,
        ...(options.resources === undefined ? {} : { resources: options.resources }),
    };
}

/**
 * Plant project and file checks on the real selected child scopes.
 * @param session the test-owned session whose selected checks to replace
 */
export function projectChecks(session: Session): void {
    const manifest = session.manifests.get('typescript')!;
    const check: CheckDeclaration = {
        ...BASE_CHECK,
        name: 'sandbox/project',
        runs: 'scope',
        summary: 'Reports the test project finding.',
        why: 'Changed files trigger the complete project check.',
        help: 'Fix the test project finding.',
        cwd: 'root' as const,
        command: [process.execPath, '-e', "console.log('Project finding'); process.exitCode = 1"],
        output: { format: 'lines' as const },
        files: manifest.files,
        fix: [process.execPath, '-e', "await Bun.write('{scope}/source.ts', 'restored')"],
    };
    const fileCheck = { ...check, name: 'sandbox/files', runs: 'files' as const };
    for (const scope of session.scopes) {
        if (scope.scope.path !== '') scope.selected = [{ ...manifest, tools: [], checks: [check, fileCheck] }];
    }
}

/**
 * Prepare one Swift check with test-owned compiler state and executable versions.
 * @param sandbox the directory disposed by the owning test
 * @param checkId the selected native check
 * @param files the test's source and authored policy overrides
 * @returns the opened input and session, with their preparation resources
 */
export async function swiftBuildInput(
    sandbox: TestdirResult,
    checkId: string,
    files: DirectoryJSON = {},
): Promise<SwiftBuildInput> {
    await using resources = new AsyncDisposableStack();
    resources.use(mockPinnedExecutables([...configurationManifests().values()].flatMap((manifest) => manifest.tools)));
    resources.use(await isolateCompilerCache());
    await createFileTree(sandbox.path, {
        'Package.swift': SWIFT_PACKAGE,
        'gspot.toml': buildPolicy(['swift']),
        ...files,
    });
    const session = await openSession(sandbox.path);
    return { session, input: buildCheckInput(session, checkId), resources: resources.move() };
}
