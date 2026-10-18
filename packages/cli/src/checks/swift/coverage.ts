import { z } from 'zod';
import { realpathSync } from 'node:fs';
import { buildFinding } from '#cli/runs/finding.ts';
import { FULL_PERCENTAGE } from '#cli/config/units.ts';
import { parseReport } from '#cli/runs/output/json.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { type Files } from '#cli/types/system/files.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { join, posix, resolve, relative } from 'node:path';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import type { TableSettings } from '#cli/types/settings/tables.ts';
import { buildPlan, prepareBuild } from '#cli/checks/swift/cache.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/dependency-files.ts';
import { type Finding, type CheckInput } from '#cli/types/runs/check.ts';
import { type SwiftBuildPlan, type CoverageReport } from '#cli/types/checks/language.ts';

import {
    SWIFT_PROGRAM,
    XCCOV_COMMAND,
    COVERAGE_BUNDLE,
    TEST_TARGET_TYPE,
    APP_TARGET_SUFFIX,
    SCRATCH_PATH_FLAG,
    SWIFT_TARGET_MODULE,
    XCODE_COVERAGE_FLAGS,
    SWIFT_CODECOV_COMMAND,
    SWIFT_DESCRIBE_COMMAND,
} from '#cli/config/checks/language/swift.ts';

async function measurePackageCoverage(
    input: CheckInput,
    plan: SwiftBuildPlan,
    files: Files,
    cwd: string,
): Promise<CoverageReport> {
    const tested = await runCheckTool(input, plan.commandArguments, { cwd });
    if (tested.code !== 0) throw new Error(formatOutputTail(tested, 'Swift tests failed'));
    const scratch = plan.commandArguments.slice(plan.commandArguments.indexOf(SCRATCH_PATH_FLAG));
    const reported = await runCheckTool(input, [...SWIFT_CODECOV_COMMAND, ...scratch], { cwd });
    if (reported.code !== 0) throw new Error(formatOutputTail(reported, 'Swift did not report its coverage path'));
    const described = await runCheckTool(input, SWIFT_DESCRIBE_COMMAND, { cwd });
    if (described.code !== 0)
        throw new Error(formatOutputTail(described, 'Swift could not describe its package targets'));
    const coverage = files.read(convertToPosixPath(relative(plan.folder, reported.stdout.trim())));
    const text = coverage === undefined ? undefined : decodeUtf8(coverage.bytes);
    if (text === undefined) throw new Error('Swift produced no UTF-8 coverage report at its reported path.');
    return parseSwiftCoverage(text, described.stdout, cwd);
}

async function measureXcodeCoverage(input: CheckInput, plan: SwiftBuildPlan, cwd: string): Promise<CoverageReport> {
    const bundle = join(plan.folder, COVERAGE_BUNDLE);
    const tested = await runCheckTool(input, [...plan.commandArguments, ...XCODE_COVERAGE_FLAGS, bundle], { cwd });
    if (tested.code !== 0)
        throw new Error(
            `Cannot measure coverage because the test run exited ${String(tested.code)}: ${formatOutputTail(tested, 'The test runner printed no error output.')}`,
        );
    const viewed = await runCheckTool(input, [...XCCOV_COMMAND, bundle], { cwd });
    if (viewed.code !== 0)
        throw new Error(
            `The test run wrote no coverage report: ${formatOutputTail(viewed, 'The coverage viewer printed no error output.')}`,
        );
    return parseReport('xccov', viewed.stdout, xccovSchema);
}

/**
 * Measures the coverage of source targets in the Swift package or Xcode project.
 * @param input the scope to test.
 * @returns coverage for source targets.
 */
async function measureCoverage(input: CheckInput): Promise<CoverageReport> {
    const plan = buildPlan(input, { purpose: 'coverage' });
    const prepared = prepareBuild(input, plan.folder);
    using files = prepared.files;
    const cwd = join(prepared.source, input.selection.scope.path);
    files.deleteTree(COVERAGE_BUNDLE);
    return plan.commandArguments[0] === SWIFT_PROGRAM
        ? await measurePackageCoverage(input, plan, files, cwd)
        : await measureXcodeCoverage(input, plan, cwd);
}

/** The source targets and source paths that Swift Package Manager reports. */
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

/** The compiler's coverage export with source line counts. */
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
 * Lists the targets under their coverage limit.
 * @param report what xccov printed.
 * @param settings the line limit and per-target limits.
 * @returns one message per short or missing target.
 */
function listCoverageShortfalls(
    report: CoverageReport,
    settings: Pick<TableSettings<'coverage'>, 'lines' | 'swift_target'>,
): string[] {
    const limits = [
        ...settings.swift_target,
        ...report.targets
            .filter(
                (target) =>
                    !settings.swift_target.some(
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
 * Runs the tests with coverage and compares each target with the line limit or its own override.
 * @param input the scope and coverage limits.
 * @returns the findings.
 */
async function checkSwiftCoverage(input: CheckInput): Promise<Finding[]> {
    const settings = input.selection.view.options('coverage');
    const report = await measureCoverage(input);
    return listCoverageShortfalls(report, settings).map((text) =>
        buildFinding(
            input,
            {
                file:
                    input.selection.view.options('swift').xcode_project ??
                    posix.join(input.selection.scope.path, PACKAGE_SWIFT),
                line: 1,
            },
            'coverage',
            text,
        ),
    );
}

/**
 * Sums the covered lines of each source target that Swift Package Manager declares.
 * @param text the coverage JSON from the compiler.
 * @param packageText the package description, including custom target paths.
 * @param folder the package path in the source copy.
 * @returns the coverage of each source target.
 */
function parseSwiftCoverage(text: string, packageText: string, folder: string): CoverageReport {
    const report = parseReport('swift test', text, swiftCoverageSchema);
    const description = parseReport('swift package', packageText, swiftPackageCoverageSchema);
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

export { checkSwiftCoverage };
