import { join, relative } from 'node:path';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { type CheckInput } from '#cli/types/execution/check.ts';
import { type CoverageReport } from '#cli/types/checks/testing.ts';
import { type SafeFolder } from '#cli/types/system/safe-folder.ts';
import { toolOutputDetail } from '#cli/execution/command/output.ts';
import { type SwiftBuildPlan } from '#cli/types/checks/language.ts';
import { buildPlan, prepareBuild } from '#cli/checks/language/swift/build-folder.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: These declarations call each other only after both modules initialize; final placement keeps their separate topics.
import { xccovSchema, parseSwiftCoverage } from '#cli/checks/testing/swift-tests.ts';
import { SWIFT_PROGRAM, SCRATCH_PATH_FLAG } from '#cli/config/checks/language/swift.ts';

import {
    XCCOV_COMMAND,
    COVERAGE_BUNDLE,
    XCODE_COVERAGE_FLAGS,
    SWIFT_CODECOV_COMMAND,
    SWIFT_DESCRIBE_COMMAND,
} from '#cli/config/checks/testing.ts';

async function packageCoverage(
    input: CheckInput,
    plan: SwiftBuildPlan,
    files: SafeFolder,
    cwd: string,
): Promise<CoverageReport> {
    const tested = await runCheckTool(input, plan.argv, { cwd });
    if (tested.code !== 0) throw new Error(toolOutputDetail(tested, 'Swift tests failed'));
    const scratch = plan.argv.slice(plan.argv.indexOf(SCRATCH_PATH_FLAG));
    const reported = await runCheckTool(input, [...SWIFT_CODECOV_COMMAND, ...scratch], { cwd });
    if (reported.code !== 0) throw new Error(toolOutputDetail(reported, 'Swift did not report its coverage path'));
    const described = await runCheckTool(input, SWIFT_DESCRIBE_COMMAND, { cwd });
    if (described.code !== 0)
        throw new Error(toolOutputDetail(described, 'Swift could not describe its package targets'));
    const coverage = files.read(relative(plan.folder, reported.stdout.trim()));
    const text = coverage === undefined ? undefined : decodeUtf8(coverage.bytes);
    if (text === undefined) throw new Error('Swift produced no UTF-8 coverage report at its reported path.');
    return parseSwiftCoverage(text, described.stdout, cwd);
}

async function xcodeCoverage(input: CheckInput, plan: SwiftBuildPlan, cwd: string): Promise<CoverageReport> {
    const bundle = join(plan.folder, COVERAGE_BUNDLE);
    const tested = await runCheckTool(input, [...plan.argv, ...XCODE_COVERAGE_FLAGS, bundle], { cwd });
    if (tested.code !== 0)
        throw new Error(
            `Cannot measure coverage because the test run exited ${String(tested.code)}: ${toolOutputDetail(tested, 'The test runner printed no diagnostic.')}`,
        );
    const viewed = await runCheckTool(input, [...XCCOV_COMMAND, bundle], { cwd });
    if (viewed.code !== 0)
        throw new Error(
            `The test run wrote no coverage report: ${toolOutputDetail(viewed, 'The coverage viewer printed no diagnostic.')}`,
        );
    return xccovSchema.parse(JSON.parse(viewed.stdout));
}

/**
 * Measure source target coverage in the selected Swift package or Xcode project.
 * @param input the selected scope and tools.
 * @returns coverage for source targets.
 */
export async function measureCoverage(input: CheckInput): Promise<CoverageReport> {
    const plan = buildPlan(input, 'coverage');
    const prepared = prepareBuild(input, plan.folder);
    using files = prepared.files;
    const cwd = join(prepared.source, input.selection.scope.path);
    files.removeTree(COVERAGE_BUNDLE);
    return plan.argv[0] === SWIFT_PROGRAM
        ? await packageCoverage(input, plan, files, cwd)
        : await xcodeCoverage(input, plan, cwd);
}
