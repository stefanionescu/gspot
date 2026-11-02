import { compareText } from '#cli/system/text.ts';
import { baselineSchema } from '#cli/schemas/engine.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { BASELINE_EXEMPT_CHECK } from '#cli/config/engine.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { BASELINE_FILE } from '#cli/config/repository/files.ts';
import type { Run, CheckResult, BaselineCount } from '#cli/types/engine/run.ts';

/**
Parse the text of a baseline file.

@param text the file contents, if the file exists.
@returns one count per file, check, and lint rule, or none without a file.
*/
export function parseBaseline(text: string | undefined): BaselineCount[] {
    if (text === undefined) return [];
    return Object.entries(parseJsonFile(BASELINE_FILE, text, baselineSchema)).flatMap(([file, checks]) =>
        Object.entries(checks).flatMap(([check, rules]) =>
            Object.entries(rules).map(([rule, count]) => ({ file, check, rule, count })),
        ),
    );
}

/**
Write the counts as the text of the baseline file, in a stable order.

@param counts the counts to keep.
*/
export function formatBaseline(counts: BaselineCount[]): string {
    const sorted = counts.toSorted(
        (left, right) =>
            compareText(left.file, right.file) ||
            compareText(left.check, right.check) ||
            compareText(left.rule, right.rule),
    );
    const files = [...Map.groupBy(sorted, ({ file }) => file)].map(([file, rows]) => {
        const checks = [...Map.groupBy(rows, ({ check }) => check)].map(
            ([check, rules]): [string, Record<string, number>] => [
                check,
                Object.fromEntries(rules.map(({ rule, count }) => [rule, count])),
            ],
        );
        return [file, Object.fromEntries(checks)] as const;
    });
    return `${JSON.stringify(Object.fromEntries(files), null, JSON_INDENT)}\n`;
}

/**
Count the findings of a run that may enter the baseline. A committed secret needs rotation, and a finding about the
setup of gspot needs a fix, so their checks stay out.

@param checks the results of the run.
@returns one count per file, check, and lint rule.
*/
export function countFindings(checks: readonly CheckResult[]): BaselineCount[] {
    const findings = checks
        .flatMap((result) => result.findings)
        .filter(({ check }) => !BASELINE_EXEMPT_CHECK.test(check));
    const groups = Map.groupBy(findings, ({ file, check, rule = check }) => JSON.stringify([file, check, rule]));
    return [...groups.values()].map((same) => {
        const [{ file, check, rule = check }] = same as [(typeof findings)[number]];
        return { file, check, rule, count: same.length };
    });
}

/**
Lower each count to what a full run finds, and drop each count that the run did not find.

@param counts the committed counts.
@param found the counts of the run.
@returns the counts that remain. None of them exceeds its committed value.
*/
export function pruneCounts(counts: BaselineCount[], found: BaselineCount[]): BaselineCount[] {
    const foundByFile = Map.groupBy(found, ({ file }) => file);
    return counts.flatMap((counted) => {
        const { check, rule } = counted;
        const match = foundByFile.get(counted.file)?.find((each) => each.check === check && each.rule === rule);
        const count = Math.min(counted.count, match?.count ?? 0);
        return count === 0 ? [] : [{ ...counted, count }];
    });
}

/**
Drop the findings that the baseline counts, and keep the rest. A count of two drops the first two findings of that file,
check, and rule. The findings of exempt checks stay, whatever the file says.

@param result the finished check.
@param run the counts that the checks of this run have not used yet.
*/
export function subtractBaseline(result: CheckResult, run: Pick<Run, 'baselineRun' | 'baselined'>): CheckResult {
    if (BASELINE_EXEMPT_CHECK.test(result.check)) return result;
    const findings = result.findings.filter(({ file, rule = result.check }) => {
        const counted = run.baselineRun.unused
            .get(file)
            ?.find((each) => each.check === result.check && each.rule === rule && each.count > 0);
        if (counted === undefined) return true;
        counted.count -= 1;
        return false;
    });
    const subtracted = result.findings.length - findings.length;
    if (subtracted > 0) run.baselined[result.check] = (run.baselined[result.check] ?? 0) + subtracted;
    return { ...result, findings };
}
