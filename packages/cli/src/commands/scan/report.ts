import cliPackage from '#cli-package' with { type: 'json' };
import {
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
} from '#cli/config/commands/setup.ts';
import { INCOMPLETE_STATUSES, RAN_STATUSES } from '#cli/config/engine.ts';
import { BYTES_PER_MEGABYTE, GSPOT_FOLDER, LINE_BREAK, MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { canIgnoreRule } from '#cli/engine/results.ts';
import { formatInitPlan, listCarryoverLines } from '#cli/generation/setup/file-plan.ts';
import { readShippedChecks } from '#cli/manifests/checks.ts';
import { findToolName, listDistinctTools } from '#cli/manifests/tools.ts';
import { listPinPrerequisites } from '#cli/repository/version-pin.ts';
import { formatCount } from '#cli/system/text/messages.ts';
import { compareText } from '#cli/system/text/order.ts';
import { quoteArgument } from '#cli/system/text/quoting.ts';
import type { ScanCategory, ScanInput, ScanReport, ScanSection } from '#cli/types/commands.ts';
import type { Finding, RunReport } from '#cli/types/engine/run.ts';

function selectCategory({ check }: Finding): string {
    const configuration = check.split('/', 1)[0] as string;
    const category = SCAN_CATEGORIES.find((each) => (each.configurations as readonly string[]).includes(configuration));
    return category?.name ?? SCAN_CODE_CATEGORY;
}

/**
List the rules with the most findings. A check that names no rule counts as one row with an empty rule, so its
findings show in the category that counts them.
*/
function listTopRules(findings: Finding[]): ScanCategory['rules'] {
    const groups = Map.groupBy(findings, ({ check, rule = '' }) => `${check} ${rule}`);
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
        const [top] = rules as [ScanCategory['rules'][number], ...ScanCategory['rules']];
        const largest = found.filter(({ check, rule = '' }) => check === top.check && rule === top.rule);
        return [{ name, count: found.length, rules, examples: largest.slice(0, SCAN_EXAMPLES_SHOWN) }];
    });
}

function buildCost({ session, report, toolBytes }: ScanInput): ScanReport['cost'] {
    const shipped = readShippedChecks();
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
    const found = readShippedChecks().get(check)?.check;
    return [
        ...rules.map((each) => `${[each.check, each.rule].join(' ').trimEnd()}  ${formatCount(each.count, 'finding')}`),
        rule !== '' && found !== undefined && canIgnoreRule(found, selectCheckCode(found))
            ? `To leave a rule out: gspot ignore ${quoteArgument(check)} --rule ${quoteArgument(rule)} --reason "<why>"`
            : `To leave files out: gspot ignore ${quoteArgument(check)} --paths <path> --reason "<why>"`,
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
        {
            title: SCAN_FORMATTING_TITLE,
            rows: [`${formatCount(filesToFormat, 'file')} ${verb} from the format that gspot uses.`],
        },
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
        },
        { title: SCAN_NEXT_STEPS_TITLE, rows: nextSteps },
    ];
}

export function buildScanReport(input: ScanInput): ScanReport {
    const { planning, report } = input;
    const findings = report.checks.flatMap((check) => check.findings);
    const formatting = findings.filter(({ check }) => SCAN_FORMAT_CHECKS.has(check));
    return {
        totals: {
            files: planning.session.repository.files.length,
            checks: new Set(report.checks.filter(({ status }) => RAN_STATUSES.has(status)).map(({ check }) => check))
                .size,
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

export function formatScanText(report: ScanReport): string {
    const sections = listSections(report).flatMap(({ title, rows }) => [
        title,
        ...rows.map((row) => (row === '' ? '' : `  ${row}`)),
        '',
    ]);
    return `${[formatTotals(report), '', ...sections].join('\n').trimEnd()}\n`;
}
