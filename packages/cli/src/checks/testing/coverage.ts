import { z } from 'zod';
import { realpathSync } from 'node:fs';
import { findingAt } from '#cli/checks/finding.ts';
import { FULL_PERCENTAGE } from '#cli/config/units.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { type Files } from '#cli/types/system/files.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { join, posix, resolve, relative } from 'node:path';
import { runCheckTool } from '#cli/checks/run/command/tool.ts';
import { type CoverageReport } from '#cli/types/checks/testing.ts';
import type { TableSettings } from '#cli/types/settings/tables.ts';
import { type SwiftBuildPlan } from '#cli/types/checks/language.ts';
import { toolOutputDetail } from '#cli/checks/run/command/output.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/dependency-files.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { buildPlan, prepareBuild } from '#cli/checks/language/swift/build-folder.ts';
import { SWIFT_PROGRAM, SCRATCH_PATH_FLAG } from '#cli/config/checks/language/swift.ts';

import {
    XCCOV_COMMAND,
    COVERAGE_BUNDLE,
    TEST_TARGET_TYPE,
    APP_TARGET_SUFFIX,
    SWIFT_TARGET_MODULE,
    XCODE_COVERAGE_FLAGS,
    SWIFT_CODECOV_COMMAND,
    SWIFT_DESCRIBE_COMMAND,
} from '#cli/config/checks/testing.ts';

async function packageCoverage(
    input: CheckInput,
    plan: SwiftBuildPlan,
    files: Files,
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
async function measureCoverage(input: CheckInput): Promise<CoverageReport> {
    const plan = buildPlan(input, { purpose: 'coverage' });
    const prepared = prepareBuild(input, plan.folder);
    using files = prepared.files;
    const cwd = join(prepared.source, input.scope.scope.path);
    files.removeTree(COVERAGE_BUNDLE);
    return plan.argv[0] === SWIFT_PROGRAM
        ? await packageCoverage(input, plan, files, cwd)
        : await xcodeCoverage(input, plan, cwd);
}

/** The source targets and exact source paths reported by Swift Package Manager. */
const swiftPackageCoverageSchema = z.object({
    targets: z.array(
        z.object({
            name: z.string().min(1),
            path: z.string(),
            type: z.string(),
            module_type: z.string(),
            sources: z.array(z.string()),
        } satisfies SchemaShape<{ name: string; path: string; type: string; module_type: string; sources: string[] }>),
    ),
} satisfies SchemaShape<{
    targets: { name: string; path: string; type: string; module_type: string; sources: string[] }[];
}>);

/** Native compiler coverage export with source line counts. */
const swiftCoverageSchema = z.object({
    data: z.array(
        z.object({
            files: z.array(
                z.object({
                    filename: z.string(),
                    summary: z.object({
                        lines: z.object({
                            count: z.number().int().nonnegative(),
                            covered: z.number().int().nonnegative(),
                        } satisfies SchemaShape<{ count: number; covered: number }>),
                    } satisfies SchemaShape<{ lines: { count: number; covered: number } }>),
                } satisfies SchemaShape<{ filename: string; summary: { lines: { count: number; covered: number } } }>),
            ),
        } satisfies SchemaShape<{
            files: { filename: string; summary: { lines: { count: number; covered: number } } }[];
        }>),
    ),
} satisfies SchemaShape<{
    data: { files: { filename: string; summary: { lines: { count: number; covered: number } } }[] }[];
}>);

/**
 * The targets under their limit.
 * @param report what xccov printed.
 * @param settings the common limit and target overrides of the settings.
 * @returns one line of text for each target under its limit, or missing from the report.
 */
function coverageShortfalls(
    report: CoverageReport,
    settings: Pick<TableSettings<'coverage'>, 'lines' | 'target'>,
): string[] {
    const limits = [
        ...settings.target,
        ...report.targets
            .filter(
                (target) =>
                    !settings.target.some(
                        (limit) => target.name === limit.name || target.name === `${limit.name}${APP_TARGET_SUFFIX}`,
                    ),
            )
            .map((target) => ({ name: target.name, lines: settings.lines })),
    ];
    return limits.flatMap((limit) => {
        const target = report.targets.find(
            (entry) => entry.name === limit.name || entry.name === `${limit.name}${APP_TARGET_SUFFIX}`,
        );
        if (target === undefined) return [`The coverage report has no target named ${limit.name}.`];
        const covered = Math.floor(target.lineCoverage * FULL_PERCENTAGE);
        return covered >= limit.lines
            ? []
            : [`${limit.name} covers ${String(covered)}% of its lines, under the limit of ${String(limit.lines)}%.`];
    });
}

/**
 * Runs the tests with coverage and compares each named target with its limit. Uses the common line limit and explicit target overrides.
 * @param input the check input.
 * @returns the findings.
 */
async function swiftTestsCoverage(input: CheckInput): Promise<Finding[]> {
    const settings = input.scope.view.options('coverage');
    const report = await measureCoverage(input);
    return coverageShortfalls(report, settings).map((text) =>
        findingAt(
            input,
            {
                file: input.scope.view.options('xcode').project ?? posix.join(input.scope.scope.path, PACKAGE_SWIFT),
                line: 1,
            },
            'coverage',
            text,
        ),
    );
}

/**
 * Attribute covered source lines to Swift Package Manager's actual target declarations.
 * @param text compiler coverage report at the reported Swift path.
 * @param packageText the package description, including custom target paths.
 * @param folder the selected package folder in the source copy.
 * @returns source target coverage without test targets or derived runner sources.
 */
function parseSwiftCoverage(text: string, packageText: string, folder: string): CoverageReport {
    const report = swiftCoverageSchema.parse(JSON.parse(text));
    const description = swiftPackageCoverageSchema.parse(JSON.parse(packageText));
    const root = realpathSync(folder);
    const measured = new Map(
        report.data.flatMap((data) => data.files).map((file) => [file.filename, file.summary.lines]),
    );
    return {
        targets: description.targets
            .filter((target) => target.type !== TEST_TARGET_TYPE && target.module_type === SWIFT_TARGET_MODULE)
            .flatMap((target) => {
                const lines = target.sources.flatMap((source) => {
                    const file = measured.get(resolve(root, target.path, source));
                    return file === undefined ? [] : [file];
                });
                if (lines.length === 0)
                    throw new Error(`The Swift coverage report has no source lines for target ${target.name}.`);
                const count = lines.reduce((total, entry) => total + entry.count, 0);
                const covered = lines.reduce((total, entry) => total + entry.covered, 0);
                return [{ name: target.name, lineCoverage: count === 0 ? 1 : covered / count }];
            }),
    };
}

const xccovSchema = z.object({
    targets: z.array(
        z.object({ name: z.string().min(1), lineCoverage: z.number().min(0).max(1) } satisfies SchemaShape<
            CoverageReport['targets'][number]
        >),
    ),
} satisfies SchemaShape<CoverageReport>);

export { swiftTestsCoverage, parseSwiftCoverage };
