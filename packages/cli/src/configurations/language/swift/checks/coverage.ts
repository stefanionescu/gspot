import { realpathSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';

import {
    APP_TARGET_SUFFIX,
    COVERAGE_BUNDLE,
    COVERAGE_RULE,
    FAILED_BUILD_NOTE,
    FAILED_TEST_RULE,
    MISSING_COVERAGE_MESSAGE,
    SCRATCH_PATH_FLAG,
    SWIFT_CODECOV_COMMAND,
    SWIFT_DESCRIBE_COMMAND,
    SWIFT_PACKAGE_NAME,
    SWIFT_TARGET_MODULE,
    SWIFT_TEST_NAME,
    SWIFT_TESTING_FAILURE_LINE,
    SWIFT_TESTS_MESSAGE,
    TEST_RUNNER_MESSAGE,
    TEST_TARGET_TYPE,
    XCCOV_COMMAND,
    XCODE_COVERAGE_FLAGS,
    XCTEST_FAILURE_LINE,
} from '#cli/config/configurations/swift.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/projects.ts';
import { MAX_PERCENTAGE } from '#cli/config/settings/schema.ts';
import { runSwiftBuild, stripPrivatePrefix } from '#cli/configurations/language/swift/checks/build.ts';
import { planSwiftBuild } from '#cli/configurations/language/swift/checks/cache.ts';
import { SWIFT_TEST_EXPLANATIONS } from '#cli/configurations/language/swift/explanations.ts';
import { formatOutputTail } from '#cli/engine/tool-runs/output.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { packageDescriptionSchema, swiftCoverageSchema, xccovSchema } from '#cli/schemas/configurations.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { CoverageOutput, CoverageRun, SwiftBuildPlan } from '#cli/types/configurations/language.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckFinding, type CheckSession } from '#cli/types/engine/run.ts';
import type { TableSettings } from '#cli/types/settings.ts';
import type { Files } from '#cli/types/system.ts';

function findFailureFile(planned: PlannedCheck, file: string, cwd: string): string | undefined {
    const restored = stripPrivatePrefix(file);
    const root = stripPrivatePrefix(cwd);
    if (isAbsolute(restored)) return joinScope(planned.scope.path, convertToPosixPath(relative(root, restored)));
    const isTest = buildPathMatcher(planned.scope.settings.test_files);
    const matches = planned.files.filter((file) => isTest(file.path) && basename(file.path) === restored);
    return matches.length === 1 ? matches[0]?.path : undefined;
}

function parseFailureLine(planned: PlannedCheck, line: string, cwd: string): CheckFinding | undefined {
    const groups = (XCTEST_FAILURE_LINE.exec(line) ?? SWIFT_TESTING_FAILURE_LINE.exec(line))?.groups;
    if (groups === undefined) return undefined;
    const file = findFailureFile(planned, groups['file'] ?? '', cwd);
    if (file === undefined) return undefined;
    return {
        file,
        line: Number(groups['line']),
        ...(groups['column'] !== undefined && { column: Number(groups['column']) }),
        rule: FAILED_TEST_RULE,
        message: groups['message'] ?? '',
    };
}

/**
Report the failed tests of a test run that exited with an error.

@throws CheckStop with `message` when the output names no failed test.
*/
function parseFailedTests(
    planned: PlannedCheck,
    tested: { stdout: string; stderr: string },
    run: { cwd: string; message: string },
): CoverageRun {
    const lines = new Set(`${tested.stdout}\n${tested.stderr}`.split('\n'));
    const failures = [...lines].flatMap((line) => parseFailureLine(planned, line, run.cwd) ?? []);
    if (failures.length === 0) throw new CheckStop('error', run.message);
    return { targets: [], failures };
}

async function measurePackageCoverage(
    session: CheckSession,
    planned: PlannedCheck,
    plan: Extract<SwiftBuildPlan, { kind: 'package' }>,
    files: Files,
    cwd: string,
): Promise<CoverageRun> {
    const tested = await runCheckTool(session, planned, plan.testArguments, { cwd });
    if (tested.code !== 0)
        return parseFailedTests(planned, tested, { cwd, message: formatOutputTail(tested, SWIFT_TESTS_MESSAGE) });
    const reported = await runCheckTool(session, planned, [...SWIFT_CODECOV_COMMAND, SCRATCH_PATH_FLAG, plan.scratch], {
        cwd,
        exitCodes: [],
    });
    const described = await runCheckTool(session, planned, SWIFT_DESCRIBE_COMMAND, { cwd, exitCodes: [] });
    const reportPath = reported.stdout.trim();
    const coverage = files.read(convertToPosixPath(relative(plan.folder, reportPath)));
    const text = coverage === undefined ? undefined : decodeUtf8(coverage.bytes);
    if (text === undefined) throw new CheckStop('error', MISSING_COVERAGE_MESSAGE);
    return { ...parseSwiftCoverage(text, described.stdout, cwd), failures: [] };
}

async function measureXcodeCoverage(
    session: CheckSession,
    planned: PlannedCheck,
    plan: SwiftBuildPlan,
    cwd: string,
): Promise<CoverageRun> {
    const bundle = join(plan.folder, COVERAGE_BUNDLE);
    const tested = await runCheckTool(session, planned, [...plan.testArguments, ...XCODE_COVERAGE_FLAGS, bundle], {
        cwd,
    });
    if (tested.code !== 0)
        return parseFailedTests(planned, tested, {
            cwd,
            message: `Cannot measure coverage because the test run exited ${String(tested.code)}: ${formatOutputTail(tested, TEST_RUNNER_MESSAGE)}`,
        });
    const viewed = await runCheckTool(session, planned, [...XCCOV_COMMAND, bundle], { cwd, exitCodes: [] });
    return { ...parseToolOutput('xccov', viewed.stdout, xccovSchema), failures: [] };
}

async function measureCoverage(session: CheckSession, planned: PlannedCheck): Promise<CoverageRun> {
    const plan = planSwiftBuild(session, planned);
    const { code, files, source } = await runSwiftBuild(session, planned, plan, { clean: false });
    if (code !== 0) throw new CheckStop('skipped', FAILED_BUILD_NOTE);
    const cwd = join(source, planned.scope.path);
    files.deleteTree(COVERAGE_BUNDLE);
    return plan.kind === 'package'
        ? await measurePackageCoverage(session, planned, plan, files, cwd)
        : await measureXcodeCoverage(session, planned, plan, cwd);
}

function isLimitedTarget(name: string, limit: string): boolean {
    return name === limit || name === `${limit}${APP_TARGET_SUFFIX}`;
}

function listCoverageShortfalls(
    output: CoverageOutput,
    settings: Pick<TableSettings<'coverage'>, 'min_line_percent' | 'swift_target'>,
): string[] {
    const limits = [
        ...settings.swift_target,
        ...output.targets
            .filter((target) => settings.swift_target.every((limit) => !isLimitedTarget(target.name, limit.name)))
            .map((target) => ({ name: target.name, min_line_percent: settings.min_line_percent })),
    ];
    return limits.flatMap((limit) => {
        const target = output.targets.find((each) => isLimitedTarget(each.name, limit.name));
        if (target === undefined) return [`The coverage report has no target named ${limit.name}.`];
        const covered = Math.floor(target.lineCoverage * MAX_PERCENTAGE);
        return covered >= limit.min_line_percent
            ? []
            : [
                  `${limit.name} covers ${String(covered)}% of its lines, under the limit of ${String(limit.min_line_percent)}%.`,
              ];
    });
}

function parseSwiftCoverage(text: string, packageText: string, folder: string): CoverageOutput {
    const report = parseToolOutput(SWIFT_TEST_NAME, text, swiftCoverageSchema);
    const description = parseToolOutput(SWIFT_PACKAGE_NAME, packageText, packageDescriptionSchema);
    const root = realpathSync(folder);
    const measured = new Map(
        report.data
            .flatMap((coverageExport) => coverageExport.files)
            .map((file) => [file.filename, file.summary.lines]),
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
                    throw new CheckStop(
                        'error',
                        `The Swift coverage report has no source lines for target ${target.name}.`,
                    );
                const count = lines.reduce((total, line) => total + line.count, 0);
                const covered = lines.reduce((total, line) => total + line.covered, 0);
                return { name: target.name, lineCoverage: count === 0 ? 1 : covered / count };
            }),
    };
}

async function checkSwiftTests(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const settings = getTable(planned.scope.settings, COVERAGE_RULE);
    const report = await measureCoverage(session, planned);
    if (report.failures.length > 0) return report.failures;
    return listCoverageShortfalls(report, settings).map((text) => ({
        file: getTable(planned.scope.settings, 'swift').xcode_project ?? joinScope(planned.scope.path, PACKAGE_SWIFT),
        line: 1,
        rule: COVERAGE_RULE,
        message: text,
    }));
}

export const SWIFT_COVERAGE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'swift/tests': { check: checkSwiftTests, explanations: SWIFT_TEST_EXPLANATIONS },
};
