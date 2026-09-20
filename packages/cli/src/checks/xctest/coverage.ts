// Line coverage of the targets the policy names, from one xcodebuild test run.
import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { swiftBuildPlan } from '#cli/checks/swift/plan.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';
import type { CoverageFloor, CoverageReport } from '#types/apple.ts';

const TEST_TIMEOUT_MS = 3_600_000;
const PERCENT = 100;

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
    const floors = input.view.tool('xctest')['coverage'] as CoverageFloor[];
    const plan = swiftBuildPlan(input);
    const bundle = join(plan.folder, 'coverage.xcresult');
    mkdirSync(plan.folder, { recursive: true });
    rmSync(bundle, { recursive: true, force: true });
    const argv = plan.argv
        .map((part) => (part === 'build-for-testing' ? 'test' : part))
        .filter((part) => part !== 'clean');
    const tested = await run([...argv, '-enableCodeCoverage', 'YES', '-resultBundlePath', bundle], {
        cwd: plan.cwd,
        timeoutMs: TEST_TIMEOUT_MS,
    });
    if (tested.missing) throw new MissingToolError('The xcodebuild command is not installed.');
    const viewed = await run(['xcrun', 'xccov', 'view', '--report', '--json', bundle], {
        cwd: plan.cwd,
        timeoutMs: TEST_TIMEOUT_MS,
    });
    if (viewed.code !== 0)
        throw new Error(`The test run wrote no coverage report: ${tested.stderr.trim().split('\n').at(-1) ?? ''}`);
    const report = JSON.parse(viewed.stdout) as CoverageReport;
    return underFloor(report, floors).map((text) => ({
        check: input.spec.name,
        file: '',
        line: 1,
        rule: 'coverage',
        message: text,
        fixable: false,
    }));
}
