import { realpathSync } from 'node:fs';
import { parseReport } from '#cli/parsers/json.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import { join, resolve, relative } from 'node:path';
import { joinScope } from '#cli/repository/scopes.ts';
import { FULL_PERCENTAGE } from '#cli/config/units.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { type Files } from '#cli/types/system/files.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import type { TableSettings } from '#cli/types/settings/tables.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/dependencies.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { buildPlan, prepareBuild } from '#cli/checks/swift/cache.ts';
import { type SwiftBuildPlan, type CoverageReport } from '#cli/types/checks/swift.ts';
import { xccovSchema, swiftCoverageSchema, swiftPackageCoverageSchema } from '#cli/schemas/checks/swift.ts';

import {
    XCCOV_COMMAND,
    COVERAGE_BUNDLE,
    TEST_TARGET_TYPE,
    APP_TARGET_SUFFIX,
    SCRATCH_PATH_FLAG,
    SWIFT_TARGET_MODULE,
    XCODE_COVERAGE_FLAGS,
    SWIFT_CODECOV_COMMAND,
    SWIFT_DESCRIBE_COMMAND,
} from '#cli/config/checks/swift.ts';

async function measurePackageCoverage(
    session: Session,
    planned: PlannedCheck,
    plan: Extract<SwiftBuildPlan, { kind: 'package' }>,
    files: Files,
    cwd: string,
): Promise<CoverageReport> {
    const tested = await runCheckTool(session, planned, plan.commandArguments, { cwd });
    if (tested.code !== 0) throw new Error(formatOutputTail(tested, 'Swift tests failed'));
    const reported = await runCheckTool(session, planned, [...SWIFT_CODECOV_COMMAND, SCRATCH_PATH_FLAG, plan.scratch], {
        cwd,
    });
    if (reported.code !== 0) throw new Error(formatOutputTail(reported, 'Swift did not report its coverage path'));
    const described = await runCheckTool(session, planned, SWIFT_DESCRIBE_COMMAND, { cwd });
    if (described.code !== 0)
        throw new Error(formatOutputTail(described, 'Swift could not describe its package targets'));
    const coverage = files.read(convertToPosixPath(relative(plan.folder, reported.stdout.trim())));
    const text = coverage === undefined ? undefined : decodeUtf8(coverage.bytes);
    if (text === undefined) throw new Error('Swift produced no UTF-8 coverage report at its reported path.');
    return parseSwiftCoverage(text, described.stdout, cwd);
}

async function measureXcodeCoverage(
    session: Session,
    planned: PlannedCheck,
    plan: SwiftBuildPlan,
    cwd: string,
): Promise<CoverageReport> {
    const bundle = join(plan.folder, COVERAGE_BUNDLE);
    const tested = await runCheckTool(session, planned, [...plan.commandArguments, ...XCODE_COVERAGE_FLAGS, bundle], {
        cwd,
    });
    if (tested.code !== 0)
        throw new Error(
            `Cannot measure coverage because the test run exited ${String(tested.code)}: ${formatOutputTail(tested, 'The test runner printed no error output.')}`,
        );
    const viewed = await runCheckTool(session, planned, [...XCCOV_COMMAND, bundle], { cwd });
    if (viewed.code !== 0)
        throw new Error(
            `The test run wrote no coverage report: ${formatOutputTail(viewed, 'The coverage viewer printed no error output.')}`,
        );
    return parseReport('xccov', viewed.stdout, xccovSchema);
}

/**
 * Measures the coverage of source targets in the Swift package or Xcode project.
 *
 * @param session the repository and its tools.
 * @param planned the scope to test.
 * @returns coverage for source targets.
 */
async function measureCoverage(session: Session, planned: PlannedCheck): Promise<CoverageReport> {
    const plan = buildPlan(session, planned, { purpose: 'coverage' });
    const prepared = prepareBuild(session.root, planned.files, plan.folder);
    using files = prepared.files;
    const cwd = join(prepared.source, planned.selection.scope.path);
    files.deleteTree(COVERAGE_BUNDLE);
    return plan.kind === 'package'
        ? await measurePackageCoverage(session, planned, plan, files, cwd)
        : await measureXcodeCoverage(session, planned, plan, cwd);
}

function isTargetNamed(target: { name: string }, name: string): boolean {
    return target.name === name || target.name === `${name}${APP_TARGET_SUFFIX}`;
}

/**
 * Lists the targets under their coverage limit.
 *
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
            .filter((target) => !settings.swift_target.some((limit) => isTargetNamed(target, limit.name)))
            .map((target) => ({ name: target.name, lines: settings.lines })),
    ];
    return limits.flatMap((limit) => {
        const target = report.targets.find((entry) => isTargetNamed(entry, limit.name));
        if (target === undefined) return [`The coverage report has no target named ${limit.name}.`];
        const covered = Math.floor(target.lineCoverage * FULL_PERCENTAGE);
        return covered >= limit.lines
            ? []
            : [`${limit.name} covers ${String(covered)}% of its lines, under the limit of ${String(limit.lines)}%.`];
    });
}

/**
 * Runs the tests with coverage and compares each target with the line limit or its own override.
 *
 * @param session the repository and its tools.
 * @param planned the scope and coverage limits.
 * @returns the findings.
 */
async function checkSwiftCoverage(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const settings = getTable(planned.selection.view, 'coverage');
    const report = await measureCoverage(session, planned);
    return listCoverageShortfalls(report, settings).map((text) =>
        buildFinding(
            planned,
            {
                file:
                    getTable(planned.selection.view, 'swift').xcode_project ??
                    joinScope(planned.selection.scope.path, PACKAGE_SWIFT),
                line: 1,
            },
            'coverage',
            text,
        ),
    );
}

/**
 * Sums the covered lines of each source target that Swift Package Manager declares.
 *
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

export { checkSwiftCoverage };
