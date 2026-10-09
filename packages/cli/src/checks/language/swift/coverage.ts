import { join, relative } from 'node:path';
import { decodeUtf8 } from '#cli/platform/contracts.ts';
import type { Root } from '#cli/types/platform/root.ts';
import { xccovSchema } from '#cli/parsers/schema/xctest.ts';
import { runCheckTool } from '#cli/execution/command/public.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { parseSwiftCoverage } from '#cli/parsers/swift/contracts.ts';
import { toolOutputDetail } from '#cli/execution/command/contracts.ts';
import type { SwiftBuildPlan } from '#cli/types/checks/language/swift.ts';
import type { CoverageReport } from '#cli/types/parsers/swift/coverage.ts';
import { buildPlan, prepareBuild } from '#cli/checks/language/swift/public.ts';

async function packageCoverage(
    input: CheckInput,
    plan: SwiftBuildPlan,
    files: Root,
    cwd: string,
): Promise<CoverageReport> {
    const tested = await runCheckTool(input, plan.argv, { cwd });
    if (tested.code !== 0) throw new Error(toolOutputDetail(tested, 'Swift tests failed'));
    const scratch = plan.argv.slice(plan.argv.indexOf('--scratch-path'));
    const reported = await runCheckTool(input, ['swift', 'test', '--show-codecov-path', ...scratch], { cwd });
    if (reported.code !== 0) throw new Error(toolOutputDetail(reported, 'Swift did not report its coverage path'));
    const described = await runCheckTool(input, ['swift', 'package', 'describe', '--type', 'json'], { cwd });
    if (described.code !== 0)
        throw new Error(toolOutputDetail(described, 'Swift could not describe its package targets'));
    const coverage = files.read(relative(plan.folder, reported.stdout.trim()));
    const text = coverage === undefined ? undefined : decodeUtf8(coverage.bytes);
    if (text === undefined) throw new Error('Swift produced no UTF-8 coverage report at its reported path.');
    return parseSwiftCoverage(text, described.stdout, cwd);
}

async function xcodeCoverage(input: CheckInput, plan: SwiftBuildPlan, cwd: string): Promise<CoverageReport> {
    const bundle = join(plan.folder, 'coverage.xcresult');
    const tested = await runCheckTool(
        input,
        [...plan.argv, '-enableCodeCoverage', 'YES', '-resultBundlePath', bundle],
        { cwd },
    );
    if (tested.code !== 0)
        throw new Error(
            `Cannot measure coverage because the test run exited ${String(tested.code)}: ${toolOutputDetail(tested, 'The test runner printed no diagnostic.')}`,
        );
    const viewed = await runCheckTool(input, ['xcrun', 'xccov', 'view', '--report', '--json', bundle], { cwd });
    if (viewed.code !== 0)
        throw new Error(
            `The test run wrote no coverage report: ${toolOutputDetail(viewed, 'The coverage viewer printed no diagnostic.')}`,
        );
    return xccovSchema.parse(JSON.parse(viewed.stdout));
}

/**
 * Measure native source target coverage in the selected Swift package or Xcode project.
 * @param input the selected scope and tools
 * @returns native coverage for source targets
 */
export async function measureCoverage(input: CheckInput): Promise<CoverageReport> {
    const plan = buildPlan(input, 'coverage');
    const prepared = prepareBuild(input, plan.folder);
    using files = prepared.files;
    const cwd = join(prepared.source, input.scope);
    files.removeTree('coverage.xcresult');
    return plan.argv[0] === 'swift'
        ? await packageCoverage(input, plan, files, cwd)
        : await xcodeCoverage(input, plan, cwd);
}
