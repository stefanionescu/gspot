// What a Swift scope builds: an Xcode scheme when the policy names a project, or the Swift package.
import { join } from 'node:path';
import { buildFolder } from '#cli/platform/paths.ts';
import type { EngineInput } from '#cli/types/execution.ts';
import { mutationTarget } from '#cli/filesystem/confined.ts';

/** The build of one Swift scope. */
export type SwiftBuildPlan = {
    /** The cache folder of this scope. */
    folder: string;
    /** Where the compiler log is written. */
    log: string;
    argv: string[];
    /** The analyzer clears this folder so its log includes every compiler call. */
    scratch?: string;
};

const DEFAULT_DESTINATION = 'generic/platform=iOS Simulator';
const WORKSPACE_SUFFIX = '.xcworkspace';

function text(input: EngineInput, key: string): string {
    const found = input.view.settings[key];
    return typeof found === 'string' ? found : '';
}

/**
 * The build of one scope: the command, the folder it runs in, and where its log goes.
 * @param input the engine input
 * @param purpose the build consumer, whose command owns a separate cache
 * @returns the plan
 */
export function swiftBuildPlan(
    input: EngineInput,
    purpose: 'compile' | 'analyze' | 'coverage' | 'periphery' = 'compile',
): SwiftBuildPlan {
    const folder = join(
        buildFolder(input.root),
        'swift',
        input.scope === '' ? 'root' : `scope-${Buffer.from(input.scope).toString('hex')}`,
        purpose,
    );
    const log = join(folder, 'build.log');
    const project = text(input, 'tools.xcode.project');
    if (project === '') {
        const scratch = join(folder, 'package');
        return {
            folder,
            log,
            ...(purpose === 'analyze' ? { scratch } : {}),
            argv: ['swift', 'build', '-v', '--scratch-path', scratch],
        };
    }
    mutationTarget(project);
    const container = project.endsWith(WORKSPACE_SUFFIX) ? '-workspace' : '-project';
    const argv = [
        'xcodebuild',
        ...(purpose === 'analyze' ? ['clean'] : []),
        'build-for-testing',
        container,
        project,
        '-scheme',
        text(input, 'tools.xcode.scheme'),
        '-destination',
        text(input, 'tools.xcode.destination') || DEFAULT_DESTINATION,
        '-derivedDataPath',
        join(folder, 'derived'),
        'CODE_SIGNING_ALLOWED=NO',
    ];
    return { folder, log, argv };
}
