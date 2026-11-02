import cliPackage from '#cli-package' with { type: 'json' };
import { INCOMPLETE_STATUSES } from '#cli/config/engine.ts';
import { HOOK_CHECKS } from '#cli/config/tools/installers.ts';
import type { Finding } from '#cli/types/engine/tool-runs.ts';
import { formatInitPlan } from '#cli/generation/setup/plan.ts';
import { compareText, formatCount } from '#cli/system/text.ts';
import { listHookNames } from '#cli/tools/installers/hooks.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import { LINE_BREAK, GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { findToolName, listDistinctTools } from '#cli/tools/pins.ts';
import type { RunReport, CheckResult } from '#cli/types/engine/run.ts';
import { listChecksById, readConfigurations } from '#cli/manifests/read.ts';
import type { ScanTime, ScanInput, ScanReport, ScanSection, ScanCategory } from '#cli/types/commands/reports.ts';

import {
    SCAN_CATEGORIES,
    SCAN_NEXT_STEPS,
    SCAN_PLAN_TITLE,
    BYTES_PER_MEGABYTE,
    SCAN_BUILT_IN_TOOL,
    SCAN_CODE_CATEGORY,
    SCAN_FORMAT_CHECKS,
    SCAN_NOT_RUN_TITLE,
    SCAN_EXAMPLES_SHOWN,
    SCAN_FORMATTING_TITLE,
    SCAN_NEXT_STEPS_TITLE,
} from '#cli/config/commands/reports.ts';

function selectCategory({ check }: Finding): string {
    const configuration = check.split('/', 1)[0] as string;
    const category = SCAN_CATEGORIES.find((each) => (each.configurations as readonly string[]).includes(configuration));
    return category?.name ?? SCAN_CODE_CATEGORY;
}

function buildCategories(findings: Finding[]): ScanCategory[] {
    const groups = Map.groupBy(findings, (finding) => selectCategory(finding));
    return SCAN_CATEGORIES.flatMap(({ name }) => {
        const found = groups.get(name) ?? [];
        if (found.length === 0) return [];
        return [{ name, count: found.length, examples: found.slice(0, SCAN_EXAMPLES_SHOWN) }];
    });
}

function listTimes(groups: [string, CheckResult[]][]): ScanTime[] {
    return groups.map(([name, checks]) => {
        const milliseconds = checks.reduce((total, { duration }) => total + duration, 0);
        return { name, seconds: milliseconds / MILLISECONDS_PER_SECOND };
    });
}

function buildCost({ session, report, toolBytes }: ScanInput): ScanReport['cost'] {
    const shipped = listChecksById(readConfigurations().values());
    const ran = report.checks.filter(({ duration }) => duration > 0);
    const tools = Map.groupBy(ran, ({ check }) => {
        const found = shipped.get(check);
        return (found === undefined ? undefined : findToolName(found.check)) ?? SCAN_BUILT_IN_TOOL;
    });
    const hooks = listHookNames(session.configuredChecks).map((name): [string, CheckResult[]] => {
        const stages: readonly string[] = HOOK_CHECKS[name].stages;
        return [name, ran.filter(({ check }) => stages.includes(shipped.get(check)?.check.stage ?? ''))];
    });
    return {
        tools: listDistinctTools(session.toolConfigurations).filter(({ kind }) => kind === 'program').length,
        megabytes: Math.round(toolBytes / BYTES_PER_MEGABYTE),
        perTool: listTimes([...tools]).toSorted(
            (left, right) => right.seconds - left.seconds || compareText(left.name, right.name),
        ),
        perHook: listTimes(hooks.filter(([, checks]) => checks.length > 0)),
    };
}

function listNotRun({ checks }: RunReport): string[] {
    const stopped = checks.filter(({ status }) => INCOMPLETE_STATUSES.has(status));
    return [...new Set(stopped.map(({ check, note }) => `${check}: ${note ?? ''}`.trim()))];
}

function listNextSteps({ pinPath, session }: ScanInput['planning']): string[] {
    const { command, installCommand } = session.startRunner;
    const add = installCommand.replace('<version>', () => cliPackage.version);
    return [...(pinPath === undefined ? [] : [add]), ...SCAN_NEXT_STEPS.map((step) => `${command} ${step}`)];
}

/**
Sum up a finished trial run.

@param input the plan of init, the session and the report of the run in the copy, and the bytes of its tools.
@returns the report that scan prints, with every finding in `checks`.
*/
export function buildScanReport(input: ScanInput): ScanReport {
    const { planning, report } = input;
    const findings = report.checks.flatMap((check) => check.findings);
    const formatting = findings.filter(({ check }) => SCAN_FORMAT_CHECKS.has(check));
    return {
        totals: {
            files: planning.session.repository.files.length,
            checks: report.checks.filter(({ status }) => status === 'passed' || status === 'failed').length,
            findings: findings.length,
            filesFlagged: new Set(findings.map(({ file }) => file).filter((file) => file !== '')).size,
            seconds: report.duration / MILLISECONDS_PER_SECOND,
        },
        categories: buildCategories(findings.filter(({ check }) => !SCAN_FORMAT_CHECKS.has(check))),
        filesToFormat: new Set(formatting.map(({ file }) => file)).size,
        notRun: listNotRun(report),
        cost: buildCost(input),
        plan: planning.plan,
        settingsText: planning.settingsText,
        nextSteps: listNextSteps(planning),
        checks: report.checks,
    };
}

function formatExample({ file, line, check, rule, message }: Finding): string {
    const place = line === undefined ? file : `${file}:${String(line)}`;
    const name = rule === undefined || rule === check ? check : `${check} ${rule}`;
    const text = message.split(LINE_BREAK).map((line) => line.trim());
    return [place, name, text.join(' ')].filter((field) => field !== '').join('  ');
}

function formatTotals({ totals }: ScanReport): string {
    const found = `${formatCount(totals.findings, 'finding')} in ${formatCount(totals.filesFlagged, 'file')}`;
    const read = `${formatCount(totals.files, 'file')} with ${formatCount(totals.checks, 'check')}`;
    return `Checked ${read} in ${totals.seconds.toFixed(1)}s: ${found}.`;
}

function listSections(report: ScanReport): ScanSection[] {
    const { categories, filesToFormat, notRun, cost, plan, settingsText, nextSteps } = report;
    const verb = filesToFormat === 1 ? 'differs' : 'differ';
    return [
        ...categories.map(({ name, count, examples }) => ({
            title: `${name}: ${formatCount(count, 'finding')}`,
            rows: examples.map((finding) => formatExample(finding)),
        })),
        { title: SCAN_FORMATTING_TITLE, rows: [`${formatCount(filesToFormat, 'file')} ${verb} from your style.`] },
        ...(notRun.length === 0 ? [] : [{ title: SCAN_NOT_RUN_TITLE, rows: notRun }]),
        {
            title: `Cost: ${formatCount(cost.tools, 'tool')}, ${String(cost.megabytes)} MB in ${GSPOT_FOLDER}/`,
            rows: [...cost.perTool, ...cost.perHook].map(({ name, seconds }) => `${name}  ${seconds.toFixed(1)}s`),
        },
        {
            title: SCAN_PLAN_TITLE,
            rows: formatInitPlan(plan, settingsText).trimEnd().split('\n'),
            preformatted: true,
        },
        { title: SCAN_NEXT_STEPS_TITLE, rows: nextSteps },
    ];
}

/**
Format the report for a terminal.

@param report what the scan found.
*/
export function formatScanText(report: ScanReport): string {
    const sections = listSections(report).flatMap(({ title, rows }) => [
        title,
        ...rows.map((row) => (row === '' ? '' : `  ${row}`)),
        '',
    ]);
    return `${[formatTotals(report), '', ...sections].join('\n').trimEnd()}\n`;
}

/**
Format the report as Markdown, to paste into a pull request or a chat.

@param report what the scan found.
*/
export function formatScanMarkdown(report: ScanReport): string {
    const sections = listSections(report).flatMap(({ title, rows, preformatted }) => [
        `## ${title}`,
        '',
        ...(preformatted === true ? ['```text', ...rows, '```'] : rows.map((row) => `- ${row}`)),
        '',
    ]);
    return `${['# gspot scan', '', formatTotals(report), '', ...sections].join('\n').trimEnd()}\n`;
}
