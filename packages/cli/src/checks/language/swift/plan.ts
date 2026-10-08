import { join, posix } from 'node:path';
import { GspotError } from '#cli/platform/errors.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { buildFolder } from '#cli/checks/language/swift/cache.ts';
import { assertMutationTarget } from '#cli/platform/root/rules.ts';
import type { SwiftBuildPlan, SwiftBuildPurpose } from '#cli/types/checks/language/swift.ts';
import { XCODE_COMMANDS, PACKAGE_COMMANDS, WORKSPACE_SUFFIX } from '#cli/config/checks/language/swift.ts';

/**
 * Locate independent native build state for one project scope and consumer.
 * @param input the repository root and project scope
 * @param purpose the native consumer whose outputs stay separate
 * @returns the build folder
 */
export function scopeBuildFolder(input: Pick<CheckInput, 'root' | 'scope'>, purpose: SwiftBuildPurpose): string {
    return join(
        buildFolder(input.root),
        'swift',
        input.scope === '' ? 'root' : `scope-${Buffer.from(input.scope).toString('hex')}`,
        purpose,
    );
}

/**
 * The build of one scope: the command, the folder it runs in, and where its log goes.
 * @param input the check input
 * @param purpose the build consumer, whose command owns a separate cache
 * @returns the plan
 */
export function buildPlan(input: CheckInput, purpose: SwiftBuildPurpose = 'compile'): SwiftBuildPlan {
    const folder = scopeBuildFolder(input, purpose);
    const log = join(folder, 'build.log');
    const {
        xcode_project: project,
        xcode_scheme: scheme,
        xcode_destination: destination,
    } = input.view.options('swift');
    if (project === '') {
        if (
            !(input.repositoryFiles ?? input.files).some(
                ({ path }) => path === posix.join(input.scope, 'Package.swift'),
            )
        )
            throw new GspotError('skip', ['Set swift.xcode_project or add Package.swift in this scope.']);
        const scratch = join(folder, 'package');
        return {
            folder,
            log,
            ...(purpose === 'analyze' ? { scratch } : {}),
            argv: ['swift', ...PACKAGE_COMMANDS[purpose], '--scratch-path', scratch],
        };
    }
    assertMutationTarget(project);
    const container = project.endsWith(WORKSPACE_SUFFIX) ? '-workspace' : '-project';
    const argv = [
        'xcodebuild',
        ...XCODE_COMMANDS[purpose],
        container,
        posix.relative(input.scope, project),
        '-scheme',
        scheme,
        '-destination',
        destination,
        '-derivedDataPath',
        join(folder, 'derived'),
        'CODE_SIGNING_ALLOWED=NO',
    ];
    return { folder, log, argv };
}
