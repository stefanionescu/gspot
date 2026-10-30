import { realpathSync } from 'node:fs';
import { getTable } from '#cli/settings/scopes.ts';
import { MAX_PERCENTAGE } from '#cli/config/units.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import type { Files } from '#cli/types/system/files.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { CheckSession } from '#cli/types/session.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import type { TableSettings } from '#cli/types/settings/file.ts';
import { join, resolve, relative, basename, isAbsolute } from 'node:path';
import { PACKAGE_SWIFT } from '#cli/config/parsers/projects/dependencies.ts';
import { SCRATCH_PATH_FLAG } from '#cli/config/checks/language/swift/cache.ts';
import { MACOS_PRIVATE_PATH } from '#cli/config/checks/language/swift/build.ts';
import { prepareBuild, planSwiftBuild } from '#cli/checks/language/swift/cache.ts';
import type { CoverageOutput, SwiftBuildPlan } from '#cli/types/checks/language/swift.ts';
import { xccovSchema, swiftCoverageSchema, packageDescriptionSchema } from '#cli/schemas/checks/language/swift.ts';

import {
    XCCOV_COMMAND,
    COVERAGE_RULE,
    COVERAGE_BUNDLE,
    SWIFT_TEST_NAME,
    FAILED_TEST_RULE,
    TEST_TARGET_TYPE,
    APP_TARGET_SUFFIX,
    SWIFT_PACKAGE_NAME,
    XCTEST_FAILURE_LINE,
    SWIFT_TARGET_MODULE,
    SWIFT_TESTS_MESSAGE,
    TEST_RUNNER_MESSAGE,
    XCODE_COVERAGE_FLAGS,
    SWIFT_CODECOV_COMMAND,
    SWIFT_CODECOV_MESSAGE,
    SWIFT_DESCRIBE_COMMAND,
    SWIFT_DESCRIBE_MESSAGE,
    COVERAGE_VIEWER_MESSAGE,
    MISSING_COVERAGE_MESSAGE,
    SWIFT_TESTING_FAILURE_LINE,
} from '#cli/config/checks/language/swift/coverage.ts';

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

function parseFailedTests(planned: PlannedCheck, output: string, cwd: string): CheckFinding[] {
    return [...new Set(output.split('\n'))].flatMap((line) => {
        const groups = (XCTEST_FAILURE_LINE.exec(line) ?? SWIFT_TESTING_FAILURE_LINE.exec(line))?.groups;
        if (groups === undefined) return [];
        const file = findFailureFile(planned, groups['file'] ?? '', cwd);
        if (file === undefined) return [];
        return [
            {
                file,
                line: Number(groups['line']),
                ...(groups['column'] === undefined ? {} : { column: Number(groups['column']) }),
                rule: FAILED_TEST_RULE,
                message: groups['message'] ?? '',
            },
        ];
    });
}

async function measurePackageCoverage(
    session: CheckSession,
    planned: PlannedCheck,
    plan: Extract<SwiftBuildPlan, { kind: 'package' }>,
    files: Files,
    cwd: string,
): Promise<CoverageOutput | CheckFinding[]> {
    const tested = await runCheckTool(session, planned, plan.commandArguments, { cwd });
    if (tested.code !== 0) {
        const findings = parseFailedTests(planned, `${tested.stdout}\n${tested.stderr}`, cwd);
        if (findings.length > 0) return findings;
        throw new Error(formatOutputTail(tested, SWIFT_TESTS_MESSAGE));
    }
    const reported = await runCheckTool(session, planned, [...SWIFT_CODECOV_COMMAND, SCRATCH_PATH_FLAG, plan.scratch], {
        cwd,
    });
    if (reported.code !== 0) throw new Error(formatOutputTail(reported, SWIFT_CODECOV_MESSAGE));
    const described = await runCheckTool(session, planned, SWIFT_DESCRIBE_COMMAND, { cwd });
    if (described.code !== 0) throw new Error(formatOutputTail(described, SWIFT_DESCRIBE_MESSAGE));
    const reportPath = reported.stdout.trim();
    const coverage = files.read(convertToPosixPath(relative(plan.folder, reportPath)));
    const text = coverage === undefined ? undefined : decodeUtf8(coverage.bytes);
    if (text === undefined) throw new Error(MISSING_COVERAGE_MESSAGE);
    return parseSwiftCoverage(text, described.stdout, cwd);
}

async function measureXcodeCoverage(
    session: CheckSession,
    planned: PlannedCheck,
    plan: SwiftBuildPlan,
    cwd: string,
): Promise<CoverageOutput | CheckFinding[]> {
    const bundle = join(plan.folder, COVERAGE_BUNDLE);
    const tested = await runCheckTool(session, planned, [...plan.commandArguments, ...XCODE_COVERAGE_FLAGS, bundle], {
        cwd,
    });
    if (tested.code !== 0) {
        const findings = parseFailedTests(planned, `${tested.stdout}\n${tested.stderr}`, cwd);
        if (findings.length > 0) return findings;
        throw new Error(
            `Cannot measure coverage because the test run exited ${String(tested.code)}: ${formatOutputTail(tested, TEST_RUNNER_MESSAGE)}`,
        );
    }
    const viewed = await runCheckTool(session, planned, [...XCCOV_COMMAND, bundle], { cwd });
    if (viewed.code !== 0)
        throw new Error(`The test run wrote no coverage report: ${formatOutputTail(viewed, COVERAGE_VIEWER_MESSAGE)}`);
    return parseToolOutput('xccov', viewed.stdout, xccovSchema);
}

async function measureCoverage(session: CheckSession, planned: PlannedCheck): Promise<CoverageOutput | CheckFinding[]> {
    const plan = planSwiftBuild(session, planned, 'coverage');
    const { files, source } = prepareBuild(session.root, planned.files, plan.folder);
    const cwd = join(source, planned.scope.path);
    files.deleteTree(COVERAGE_BUNDLE);
    return plan.kind === 'package'
        ? await measurePackageCoverage(session, planned, plan, files, cwd)
        : await measureXcodeCoverage(session, planned, plan, cwd);
}

function listCoverageShortfalls(
    output: CoverageOutput,
    settings: Pick<TableSettings<'coverage'>, 'lines' | 'swift_target'>,
): string[] {
    const limits = [
        ...settings.swift_target,
        ...output.targets
            .filter(
                (target) =>
                    !settings.swift_target.some(
                        (limit) => target.name === limit.name || target.name === `${limit.name}${APP_TARGET_SUFFIX}`,
                    ),
            )
            .map((target) => ({ name: target.name, lines: settings.lines })),
    ];
    return limits.flatMap((limit) => {
        const target = output.targets.find(
            (each) => each.name === limit.name || each.name === `${limit.name}${APP_TARGET_SUFFIX}`,
        );
        if (target === undefined) return [`The coverage report has no target named ${limit.name}.`];
        const covered = Math.floor(target.lineCoverage * MAX_PERCENTAGE);
        return covered >= limit.lines
            ? []
            : [`${limit.name} covers ${String(covered)}% of its lines, under the limit of ${String(limit.lines)}%.`];
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
                    throw new Error(`The Swift coverage report has no source lines for target ${target.name}.`);
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
export async function checkSwiftCoverage(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const settings = getTable(planned.scope.settings, COVERAGE_RULE);
    const report = await measureCoverage(session, planned);
    if (Array.isArray(report)) return report;
    return listCoverageShortfalls(report, settings).map((text) => ({
        file: getTable(planned.scope.settings, 'swift').xcode_project ?? joinScope(planned.scope.path, PACKAGE_SWIFT),
        line: 1,
        rule: COVERAGE_RULE,
        message: text,
    }));
}
