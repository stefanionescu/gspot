// What a Swift scope builds: an Xcode scheme when the policy names a project, or the Swift package.
import { join } from 'node:path';
import type { EngineInput } from '#types/run.ts';
import type { SwiftBuildPlan } from '#types/swift.ts';

const DEFAULT_DESTINATION = 'generic/platform=iOS Simulator';
const WORKSPACE_SUFFIX = '.xcworkspace';

function text(input: EngineInput, key: string): string {
    const found = input.view.settings[key];
    return typeof found === 'string' ? found : '';
}

/**
 * The build of one scope: the command, the folder it runs in, and where its log goes.
 * @param input the engine input
 * @returns the plan
 */
export function swiftBuildPlan(input: EngineInput): SwiftBuildPlan {
    const cwd = join(input.root, input.scope);
    const folder = join(
        input.root,
        '.gspot',
        'cache',
        'swift',
        input.scope === '' ? 'root' : input.scope.replaceAll('/', '-'),
    );
    const log = join(folder, 'build.log');
    const project = text(input, 'tools.xcode.project');
    if (project === '') {
        const scratch = join(folder, 'package');
        return { cwd, folder, log, scratch, argv: ['swift', 'build', '-v', '--scratch-path', scratch] };
    }
    const container = project.endsWith(WORKSPACE_SUFFIX) ? '-workspace' : '-project';
    const argv = [
        'xcodebuild',
        'clean',
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
    return { cwd, folder, log, argv };
}
