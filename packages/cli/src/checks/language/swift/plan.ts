import { join } from 'node:path';
import type { EngineInput } from '#cli/types/execution/check.ts';
import { buildFolder } from '#cli/checks/language/swift/cache.ts';
import { assertMutationTarget } from '#cli/platform/root/rules.ts';
import { WORKSPACE_SUFFIX } from '#cli/config/checks/language/swift.ts';
import type { SwiftBuildPlan, SwiftBuildPurpose } from '#cli/types/checks/language/swift.ts';

/**
 * Locate independent native build state for one project scope and consumer.
 * @param input the repository root and project scope
 * @param purpose the native consumer whose outputs stay separate
 * @returns the build folder
 */
export function scopeBuildFolder(input: Pick<EngineInput, 'root' | 'scope'>, purpose: SwiftBuildPurpose): string {
    return join(
        buildFolder(input.root),
        'swift',
        input.scope === '' ? 'root' : `scope-${Buffer.from(input.scope).toString('hex')}`,
        purpose,
    );
}

/**
 * The build of one scope: the command, the folder it runs in, and where its log goes.
 * @param input the engine input
 * @param purpose the build consumer, whose command owns a separate cache
 * @returns the plan
 */
export function buildPlan(input: EngineInput, purpose: SwiftBuildPurpose = 'compile'): SwiftBuildPlan {
    const folder = scopeBuildFolder(input, purpose);
    const log = join(folder, 'build.log');
    const project = (input.view.settings['tools.xcode.project'] as string | undefined) ?? '';
    if (project === '') {
        const scratch = join(folder, 'package');
        return {
            folder,
            log,
            ...(purpose === 'analyze' ? { scratch } : {}),
            argv: ['swift', 'build', '-v', '--scratch-path', scratch],
        };
    }
    assertMutationTarget(project);
    const container = project.endsWith(WORKSPACE_SUFFIX) ? '-workspace' : '-project';
    const argv = [
        'xcodebuild',
        ...(purpose === 'analyze' ? ['clean'] : []),
        purpose === 'coverage' ? 'test' : 'build-for-testing',
        container,
        project,
        '-scheme',
        input.view.settings['tools.xcode.scheme'] as string,
        '-destination',
        input.view.settings['tools.xcode.destination'] as string,
        '-derivedDataPath',
        join(folder, 'derived'),
        'CODE_SIGNING_ALLOWED=NO',
    ];
    return { folder, log, argv };
}
