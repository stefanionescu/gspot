import cliPackage from '#cli-package' with { type: 'json' };
import {
    BYTES_PER_MEGABYTE,
    SCAN_BUILT_IN_TOOL,
    SCAN_CARRYOVER_TITLE,
    SCAN_CATEGORIES,
    SCAN_CODE_CATEGORY,
    SCAN_COMMANDS_TITLE,
    SCAN_EXAMPLES_SHOWN,
    SCAN_FORMAT_CHECKS,
    SCAN_FORMATTING_TITLE,
    SCAN_LEFT_OUT_TITLE,
    SCAN_NEXT_STEPS,
    SCAN_NEXT_STEPS_TITLE,
    SCAN_NOT_RUN_TITLE,
    SCAN_PLAN_TITLE,
    SCAN_RULES_SHOWN,
} from '#cli/config/commands/reports.ts';
import { INCOMPLETE_STATUSES } from '#cli/config/engine.ts';
import { GSPOT_FOLDER, LINE_BREAK } from '#cli/config/parsers.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { canIgnoreRule } from '#cli/engine/results.ts';
import { formatInitPlan, listCarryoverLines } from '#cli/generation/setup/file-plan.ts';
import { listChecksById, readConfigurations } from '#cli/manifests/read.ts';
import { listPinPrerequisites } from '#cli/repository/javascript/gspot-pin.ts';
import { compareText, formatCount } from '#cli/system/text.ts';
import { findToolName, listDistinctTools } from '#cli/tools/pins.ts';
import type { ScanCategory, ScanInput, ScanReport, ScanSection } from '#cli/types/commands/reports.ts';
import type { RunReport } from '#cli/types/engine/run.ts';
import type { Finding } from '#cli/types/engine/tool-runs.ts';

function selectCategory({ check }: Finding): string {
    const configuration = check.split('/', 1)[0] as string;
    const category = SCAN_CATEGORIES.find((each) => (each.configurations as readonly string[]).includes(configuration));
    return category?.name ?? SCAN_CODE_CATEGORY;
}

function listTopRules(findings: Finding[]): ScanCategory['rules'] {
    const named = findings.filter(({ rule }) => rule !== undefined);
    const groups = Map.groupBy(named, ({ check, rule = '' }) => `${check} ${rule}`);
    return groups
        .values()
        .map((found) => {
            const [{ check, rule = '' }] = found as [Finding];
            return { check, rule, count: found.length };
        })
        .toArray()
        .toSorted((left, right) => right.count - left.count)
        .slice(0, SCAN_RULES_SHOWN);
}

function buildCategories(findings: Finding[]): ScanCategory[] {
    const groups = Map.groupBy(findings, (finding) => selectCategory(finding));
    return SCAN_CATEGORIES.flatMap(({ name }) => {
        const found = groups.get(name) ?? [];
        if (found.length === 0) return [];
        const rules = listTopRules(found);
        const [top] = rules;
        const largest =
            top === undefined ? found : found.filter(({ check, rule }) => check === top.check && rule === top.rule);
        const examples = largest.slice(0, SCAN_EXAMPLES_SHOWN);
        return [{ name, count: found.length, rules, examples }];
    });
}

function buildCost({ session, report, toolBytes }: ScanInput): ScanReport['cost'] {
    const shipped = listChecksById(readConfigurations().values());
    const ran = report.checks.filter(({ duration }) => duration > 0);
    const tools = Map.groupBy(ran, ({ check }) => {
        const found = shipped.get(check);
        return (found === undefined ? undefined : findToolName(found.check)) ?? SCAN_BUILT_IN_TOOL;
    });
    const perTool = [...tools].map(([name, checks]) => {
        const milliseconds = checks.reduce((total, { duration }) => total + duration, 0);
        return { name, seconds: milliseconds / MILLISECONDS_PER_SECOND };
    });
    return {
        tools: listDistinctTools(session.toolConfigurations).filter(({ kind }) => kind === 'program').length,
        megabytes: Math.round(toolBytes / BYTES_PER_MEGABYTE),
        perTool: perTool.toSorted((left, right) => right.seconds - left.seconds || compareText(left.name, right.name)),
    };
}

function listChecksNotRun({ checks }: RunReport): string[] {
    const stopped = checks.filter(({ status }) => INCOMPLETE_STATUSES.has(status));
    return [...Map.groupBy(stopped, ({ note = '' }) => note)].map(([note, group]) => {
        const names = [...new Set(group.map(({ check }) => check))];
        const hidden = names.length - SCAN_RULES_SHOWN;
        const more = hidden > 0 ? ` and ${String(hidden)} more` : '';
        return `${names.slice(0, SCAN_RULES_SHOWN).join(', ')}${more}: ${note}`.trim();
    });
}

function listNextSteps({ pinPath, session }: ScanInput['planning']): string[] {
    const { name, command, installCommand } = session.startRunner;
    const add = installCommand.replace('<version>', () => cliPackage.version);
    const pin = pinPath === undefined ? [] : [...listPinPrerequisites(session.root, name), add];
    return [...pin, `${command} init`, ...SCAN_NEXT_STEPS];
}

function formatExample({ file, line, check, rule, message }: Finding): string {
    const place = line === undefined ? file : `${file}:${String(line)}`;
    const name = rule === undefined || rule === check ? check : `${check} ${rule}`;
    const text = message.split(LINE_BREAK).map((line) => line.trim());
    return [place, name, text.join(' ')].filter((field) => field !== '').join('  ');
}

function formatRuleRows(rules: ScanCategory['rules']): string[] {
    const [largest] = rules;
    if (largest === undefined) return [];
    const { check, rule } = largest;
    const found = listChecksById(readConfigurations().values()).get(check)?.check;
    return [
        ...rules.map((each) => `${each.check} ${each.rule}  ${formatCount(each.count, 'finding')}`),
        found !== undefined && canIgnoreRule(found, selectCheckCode(found))
            ? `To leave a rule out: gspot ignore ${check} --rule ${rule} --reason "<why>"`
            : `To leave files out: gspot ignore ${check} --paths <path> --reason "<why>"`,
    ];
}

function formatTotals({ totals }: ScanReport): string {
    const found = `${formatCount(totals.findings, 'finding')} in ${formatCount(totals.filesFlagged, 'file')}`;
    const read = `${formatCount(totals.files, 'file')} with ${formatCount(totals.checks, 'check')}`;
    return `Checked ${read} in ${totals.seconds.toFixed(1)}s: ${found}.`;
}

function listSections(report: ScanReport): ScanSection[] {
    const { categories, filesToFormat, notRun, leftOut, cost, plan, settingsText, nextSteps } = report;
    const verb = filesToFormat === 1 ? 'differs' : 'differ';
    return [
        ...categories.map(({ name, count, rules, examples }) => ({
            title: `${name}: ${formatCount(count, 'finding')}`,
            rows: [...formatRuleRows(rules), ...examples.map((finding) => formatExample(finding))],
        })),
        { title: SCAN_FORMATTING_TITLE, rows: [`${formatCount(filesToFormat, 'file')} ${verb} from your style.`] },
        ...(notRun.length === 0 ? [] : [{ title: SCAN_NOT_RUN_TITLE, rows: notRun }]),
        ...(leftOut.length === 0 ? [] : [{ title: SCAN_LEFT_OUT_TITLE, rows: leftOut }]),
        {
            title: `Cost: ${formatCount(cost.tools, 'tool')}, ${String(cost.megabytes)} MB in ${GSPOT_FOLDER}/. Each time adds up the scopes of a tool, which run side by side.`,
            rows: cost.perTool.map(({ name, seconds }) => `${name}  ${seconds.toFixed(1)}s`),
        },
        ...(plan.lintCommands.length === 0
            ? []
            : [
                  {
                      title: SCAN_COMMANDS_TITLE,
                      rows: plan.lintCommands.map(
                          ({ file, line, command, fix }) => `${file}:${String(line)}  ${command}  ${fix}`,
                      ),
                  },
              ]),
        ...(plan.carryover.length === 0
            ? []
            : [
                  {
                      title: SCAN_CARRYOVER_TITLE,
                      rows: listCarryoverLines(plan.carryover).map(({ path, note }) => `${path}  ${note}`),
                  },
              ]),
        {
            title: SCAN_PLAN_TITLE,
            rows: formatInitPlan({ ...plan, lintCommands: [], carryover: [] }, settingsText)
                .trimEnd()
                .split('\n'),
            preformatted: true,
        },
        { title: SCAN_NEXT_STEPS_TITLE, rows: nextSteps },
    ];
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
            checks: new Set(
                report.checks
                    .filter(({ status }) => status === 'passed' || status === 'failed')
                    .map(({ check }) => check),
            ).size,
            findings: findings.length,
            filesFlagged: new Set(findings.map(({ file }) => file).filter((file) => file !== '')).size,
            seconds: report.duration / MILLISECONDS_PER_SECOND,
        },
        categories: buildCategories(findings.filter(({ check }) => !SCAN_FORMAT_CHECKS.has(check))),
        filesToFormat: new Set(formatting.map(({ file }) => file)).size,
        notRun: listChecksNotRun(report),
        leftOut: input.leftOut,
        cost: buildCost(input),
        plan: {
            ...planning.plan,
            carryover: [
                ...planning.plan.carryover.filter(({ path }) => input.ruleRows.every((row) => row.path !== path)),
                ...input.ruleRows,
            ],
        },
        settingsText: planning.settingsText,
        nextSteps: listNextSteps(planning),
        checks: report.checks,
    };
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
