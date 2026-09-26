import { z } from 'zod';
import { join } from 'node:path';
import { PERCENT } from '#cli/constants/checks/xctest.ts';
import type { ConfinedRoot } from '#cli/types/platform.ts';
import { swiftBuildPlan } from '#cli/checks/swift/plan.ts';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';
import { openBuildCache, prepareBuildSources } from '#cli/checks/swift/cache.ts';
import type { CoverageFloor, XcodeCoverageReport as CoverageReport } from '#cli/types/checks/xcode.ts';

const coverageReportSchema = z.object({
    targets: z.array(z.object({ name: z.string().min(1), lineCoverage: z.number().min(0).max(1) })),
});
// Removes one entry of the previous result bundle, queueing a folder for the walk.
function removeBundleEntry(files: ConfinedRoot, path: string, directories: string[]): void {
    if (files.stat(path)?.isDirectory() === true) {
        directories.push(path);
        return;
    }
    const previous = files.read(path);
    if (previous !== undefined) files.remove(path, previous);
}

// Removes the result bundle of the previous run, file by file and then folder by folder.
function removePreviousBundle(files: ConfinedRoot): void {
    if (files.stat('coverage.xcresult') === undefined) return;
    const directories = ['coverage.xcresult'];
    for (const directory of directories)
        for (const name of files.list(directory)) removeBundleEntry(files, `${directory}/${name}`, directories);
    for (const directory of directories.toReversed()) files.rmdir(directory);
}

// Runs the tests with coverage on, then prints the coverage report of the result bundle.
async function measureCoverage(
    input: EngineInput,
    buildArgv: string[],
    bundle: string,
    cwd: string,
): Promise<{ stdout: string }> {
    const argv = buildArgv
        .map((part) => (part === 'build-for-testing' ? 'test' : part))
        .filter((part) => part !== 'clean');
    const tested = await runCheckCommand(input, [...argv, '-enableCodeCoverage', 'YES', '-resultBundlePath', bundle], {
        cwd,
    });
    if (tested.code !== 0)
        throw new Error(
            `Cannot measure coverage because the test run exited ${String(tested.code)}: ${tested.stderr.trim()}`,
        );
    const viewed = await runCheckCommand(input, ['xcrun', 'xccov', 'view', '--report', '--json', bundle], { cwd });
    if (viewed.code !== 0)
        throw new Error(`The test run wrote no coverage report: ${viewed.stderr.trim().split('\n').at(-1) ?? ''}`);
    return viewed;
}

/**
 * The targets under their floor.
 * @param report what xccov printed
 * @param floors the floors of the policy
 * @returns one line of text for each target under its floor, or missing from the report
 */
export function underFloor(report: CoverageReport, floors: CoverageFloor[]): string[] {
    return floors.flatMap((floor) => {
        const target = (report.targets ?? []).find(
            (entry) => entry.name === floor.target || entry.name === `${floor.target}.app`,
        );
        if (target === undefined) return [`The coverage report holds no target named ${floor.target}.`];
        const covered = Math.floor(target.lineCoverage * PERCENT);
        return covered >= floor.percent
            ? []
            : [`${floor.target} covers ${String(covered)} of 100 lines, under the floor of ${String(floor.percent)}.`];
    });
}

/**
 * Runs the tests with coverage and compares each named target with its floor. The planner requires configured floors.
 * @param input the engine input
 * @returns the findings
 */
export async function testCoverage(input: EngineInput): Promise<Finding[]> {
    if (input.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    if (input.view.tool('xcode')['project'] === '')
        throw new Error('Set tools.xcode.project and tools.xcode.scheme before measuring XCTest coverage.');
    const floors = input.view.tool('xctest')['coverage'] as CoverageFloor[];
    const plan = swiftBuildPlan(input, 'coverage');
    const bundle = join(plan.folder, 'coverage.xcresult');
    const files = openBuildCache(plan.folder);
    try {
        const source = prepareBuildSources(
            input.root,
            input.files.map((file) => file.path),
            plan.folder,
            files,
        );
        const cwd = join(source, input.scope);
        removePreviousBundle(files);
        const viewed = await measureCoverage(input, plan.argv, bundle, cwd);
        const report = coverageReportSchema.parse(JSON.parse(viewed.stdout));
        return underFloor(report, floors).map((text) => ({
            check: input.spec.name,
            file: '',
            line: 1,
            rule: 'coverage',
            message: text,
            fixable: false,
        }));
    } finally {
        files.close();
    }
}
