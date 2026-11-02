import { runTool } from '#cli/tools/run.ts';
import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/system/errors.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { RUFF_SELECTOR } from '#cli/config/settings/schema.ts';
import { printedRulesSchema } from '#cli/schemas/generation.ts';
import { listRepositoryExecutablePaths } from '#cli/tools/locate.ts';

import type {
    RuffRules,
    RuleState,
    RuleTable,
    CarryoverRow,
    PrintedRules,
    ComparedRules,
    RuffRuleInput,
    RuleComparison,
} from '#cli/types/generation.ts';
import {
    LIMIT_RULE,
    FIRST_NUMBER,
    RUFF_CHECK_ID,
    RUFF_ANY_PREFIX,
    RUFF_ALL_SELECTOR,
    REASON_PLACEHOLDER,
    CARRYOVER_ROW_START,
    PRINT_TIMEOUT_SECONDS,
} from '#cli/config/repository/setup.ts';

function isWeakerRule(rule: string, user: unknown[], shipped: unknown[]): boolean {
    const value = FIRST_NUMBER.exec(JSON.stringify(user))?.[0];
    const limit = FIRST_NUMBER.exec(JSON.stringify(shipped))?.[0];
    return LIMIT_RULE.test(rule) && value !== undefined && limit !== undefined && Number(value) > Number(limit);
}

function formatIgnoreLine(check: string, rule: string, file?: string): string {
    const anchored = file?.includes('/') === false ? `**/${file}` : file;
    const paths = anchored === undefined ? '' : ` --paths ${quoteArgument(anchored)}`;
    const name = quoteArgument(rule);
    return `gspot ignore ${check} --rule ${name}${paths} --reason ${REASON_PLACEHOLDER}`;
}

function classifyRule(rule: string, state: RuleState, shipped: RuleState | undefined): keyof ComparedRules {
    if (shipped?.on !== true) return state.on ? 'added' : 'covered';
    if (!state.on || isWeakerRule(rule, state.options, shipped.options)) return 'reasons';
    return isDeepStrictEqual(state.options, shipped.options) ? 'covered' : 'options';
}

/**
Turn the value that a tool prints for one rule into its state.

@param value the printed value.
@param hasSeverity whether the first element of the value holds a severity.
*/
export function convertRule(value: unknown, hasSeverity: boolean): RuleState {
    const [first, ...rest] = [value].flat();
    if (hasSeverity) return { on: first !== 0 && first !== 'off', options: rest };
    if (first === null || first === false) return { on: false, options: [] };
    return { on: true, options: first === true ? rest : [first, ...rest] };
}

/**
Compare the names and options of the rules of a replaced config with what gspot runs. The same rule counts as covered.
A rule that gspot runs with other options carries over, unless the options give a weaker limit. A rule that the user
turned off, or weakened, needs a reason. The caller decides what happens to a rule that gspot does not run.

@param input the check, the rules of the user, and what gspot runs.
*/
export function compareRules(input: RuleComparison): ComparedRules {
    const groups = Map.groupBy(input.user, ([rule, state]) => classifyRule(rule, state, input.lookup(rule)));
    return {
        covered: groups.get('covered')?.length ?? 0,
        options: new Map((groups.get('options') ?? []).map(([rule, { options }]) => [rule, options])),
        reasons: (groups.get('reasons') ?? []).map(([rule]) => formatIgnoreLine(input.check, rule)),
        added: (groups.get('added') ?? []).map(([rule]) => rule),
    };
}

/**
Compare the selectors of a Ruff config with the selectors that gspot runs. A selector counts as covered when a selector
of gspot holds it: E5 holds E501, and A holds A001 but no selector of another Ruff plugin. A rule that the config turns
off needs a reason when a shipped or a carried selector holds it.

@param input the Ruff settings, and the selectors that gspot runs.
*/
export function compareRuffRules(input: RuffRuleInput): RuffRules {
    const { path, options, shipped } = input;
    const lint = { ...options, ...options.lint };
    const selected = [...(lint.select ?? []), ...(lint['extend-select'] ?? [])];
    const running = new RegExp(String.raw`^(?:${shipped.join('|')})(?:\d|$)`, 'u');
    const added = selected.filter((rule) => !running.test(rule));
    const rules = added.filter((rule) => RUFF_SELECTOR.test(rule));
    const held = [...shipped, ...rules].join('|').replace(RUFF_ALL_SELECTOR, () => RUFF_ANY_PREFIX);
    const runsAfterInit = new RegExp(String.raw`^(?:${held})(?:\d|$)`, 'u');
    const perFile = [lint['per-file-ignores'], lint['extend-per-file-ignores']].flatMap((table) =>
        table === undefined ? [] : Object.entries(table),
    );
    const turnedOff = [
        ...[...(lint.ignore ?? []), ...(lint['extend-ignore'] ?? [])].map((rule) => ({ rule, file: undefined })),
        ...perFile.flatMap(([file, ignored]) => ignored.map((rule) => ({ rule, file }))),
    ];
    const row: CarryoverRow = {
        ...CARRYOVER_ROW_START,
        path,
        tool: 'ruff',
        covered: selected.length - added.length,
        carried: rules,
        reasons: turnedOff
            .filter(({ rule }) => runsAfterInit.test(rule))
            .map(({ rule, file }) => formatIgnoreLine(RUFF_CHECK_ID, rule, file)),
        dropped: [
            ...Object.entries({ '': options, 'lint.': options.lint, 'format.': options.format }).flatMap(
                ([prefix, table]) => (table?.dropped ?? []).map((key) => `${prefix}${key}`),
            ),
            ...added.filter((rule) => !RUFF_SELECTOR.test(rule)),
            ...turnedOff.map(({ rule }) => rule).filter((rule) => !RUFF_SELECTOR.test(rule)),
        ],
    };
    return { rules, row };
}

/**
Read the rules that a tool of the repository or of gspot resolves.

@param input where the tool sits, and how it prints its settings.
@returns the rules, or undefined when no tool can print them.
*/
export async function readPrintedRules(input: PrintedRules): Promise<RuleTable | undefined> {
    const { root, tool, search, commandArguments, hasSeverity } = input;
    const [program] = listRepositoryExecutablePaths(root, tool, search);
    if (program === undefined) return undefined;
    const printed = await runTool([program, ...commandArguments], { cwd: root, timeoutSeconds: PRINT_TIMEOUT_SECONDS });
    if (printed.code !== 0) return undefined;
    try {
        const { rules } = parseJsonFile(tool, printed.stdout, printedRulesSchema);
        return new Map(Object.entries(rules).map(([rule, value]) => [rule, convertRule(value, hasSeverity)]));
    } catch (error) {
        if (error instanceof GspotError) return undefined;
        throw error;
    }
}
