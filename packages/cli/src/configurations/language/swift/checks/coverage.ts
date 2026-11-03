import { realpathSync } from 'node:fs';
import { CheckStop } from '#cli/system/errors.ts';
import type { Files } from '#cli/types/system.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { TableSettings } from '#cli/types/settings.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import type { CheckSession } from '#cli/types/engine/run.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { MAX_PERCENTAGE } from '#cli/config/settings/schema.ts';
import { formatOutputTail } from '#cli/engine/tool-runs/output.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { join, resolve, relative, basename, isAbsolute } from 'node:path';
import { runSwiftBuild } from '#cli/configurations/language/swift/checks/build.ts';
import { planSwiftBuild } from '#cli/configurations/language/swift/checks/cache.ts';
import type { CoverageRun, CoverageOutput, SwiftBuildPlan } from '#cli/types/configurations/language.ts';
import { xccovSchema, swiftCoverageSchema, packageDescriptionSchema } from '#cli/schemas/configurations.ts';

import {
    XCCOV_COMMAND,
    COVERAGE_RULE,
    COVERAGE_BUNDLE,
    SWIFT_TEST_NAME,
    FAILED_TEST_RULE,
    TEST_TARGET_TYPE,
    FAILED_BUILD_NOTE,
    SCRATCH_PATH_FLAG,
    APP_TARGET_SUFFIX,
    MACOS_PRIVATE_PATH,
    SWIFT_PACKAGE_NAME,
    XCTEST_FAILURE_LINE,
    SWIFT_TARGET_MODULE,
    SWIFT_TESTS_MESSAGE,
    TEST_RUNNER_MESSAGE,
    XCODE_COVERAGE_FLAGS,
    SWIFT_CODECOV_COMMAND,
    SWIFT_DESCRIBE_COMMAND,
    MISSING_COVERAGE_MESSAGE,
    SWIFT_TESTING_FAILURE_LINE,
} from '#cli/config/configurations/builds.ts';

function findFailureFile(planned: PlannedCheck, file: string, cwd: string): string | undefined {
    const restored = file.replaceAll(
        MACOS_PRIVATE_PATH,
        (_match, before: string, folder: string) => `${before}/${folder}/`,
    );
    const root = cwd.replaceAll(MACOS_PRIVATE_PATH, (_match, before: string, folder: string) => `${before}/${folder}/`);
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

function parseFailedTests(planned: PlannedCheck, output: string, cwd: string): CheckFinding[] {
    const lines = new Set(output.split('\n'));
    return [...lines].flatMap((line) => parseFailureLine(planned, line, cwd) ?? []);
}

async function measurePackageCoverage(
    session: CheckSession,
    planned: PlannedCheck,
    plan: Extract<SwiftBuildPlan, { kind: 'package' }>,
    files: Files,
    cwd: string,
): Promise<CoverageRun> {
    const tested = await runCheckTool(session, planned, plan.testArguments, { cwd });
    if (tested.code !== 0) {
        const failures = parseFailedTests(planned, `${tested.stdout}\n${tested.stderr}`, cwd);
        if (failures.length > 0) return { targets: [], failures };
        throw new CheckStop('error', formatOutputTail(tested, SWIFT_TESTS_MESSAGE));
    }
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
    if (tested.code !== 0) {
        const failures = parseFailedTests(planned, `${tested.stdout}\n${tested.stderr}`, cwd);
        if (failures.length > 0) return { targets: [], failures };
        throw new CheckStop(
            'error',
            `Cannot measure coverage because the test run exited ${String(tested.code)}: ${formatOutputTail(tested, TEST_RUNNER_MESSAGE)}`,
        );
    }
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

function listCoverageShortfalls(
    output: CoverageOutput,
    settings: Pick<TableSettings<'coverage'>, 'min_line_percent' | 'swift_target'>,
): string[] {
    const limits = [
        ...settings.swift_target,
        ...output.targets
            .filter((target) =>
                settings.swift_target.every(
                    (limit) => !(target.name === limit.name || target.name === `${limit.name}${APP_TARGET_SUFFIX}`),
                ),
            )
            .map((target) => ({ name: target.name, min_line_percent: settings.min_line_percent })),
    ];
    return limits.flatMap((limit) => {
        const target = output.targets.find(
            (each) => each.name === limit.name || each.name === `${limit.name}${APP_TARGET_SUFFIX}`,
        );
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

/**
Runs the tests with coverage and compares each target with the line limit or its own override.

@param session the repository and its tools.
@param planned the scope and coverage limits.
*/
export async function checkCoverage(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
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
