import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import {
    CARRYOVER_ROW_START,
    FIRST_NUMBER,
    IGNORE_FILES,
    LIMIT_RULE,
    NOT_COMPARED_MESSAGE,
    OTHER_CONFIG_MESSAGE,
    PRINT_TIMEOUT_SECONDS,
    PRINTED_RULE_TOOLS,
    REASON_PLACEHOLDER,
    RUFF_ALL_SELECTOR,
    RUFF_ANY_PREFIX,
    RULE_PRINT_FLAG,
} from '#cli/config/generation/setup.ts';
import { RUFF_IMPORT_ORDER_SELECTOR, RUFF_SELECTOR } from '#cli/config/settings/schema.ts';
import { listToolNames } from '#cli/manifests/read.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { printedRulesSchema } from '#cli/schemas/generation.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { escapeRegExp, quoteArgument } from '#cli/system/text.ts';
import { listRepositoryExecutablePaths } from '#cli/tools/locate.ts';
import { runTool } from '#cli/tools/run.ts';
import type {
    CarryoverRow,
    ComparedRules,
    InitPlanning,
    PrintedRules,
    RuffRuleInput,
    RuffRules,
    RuleComparison,
    RuleRead,
    RuleState,
    RuleTable,
} from '#cli/types/generation.ts';

function isWeakerRule(rule: string, user: unknown[], shipped: unknown[]): boolean {
    const value = FIRST_NUMBER.exec(JSON.stringify(user))?.[0];
    const limit = FIRST_NUMBER.exec(JSON.stringify(shipped))?.[0];
    return LIMIT_RULE.test(rule) && value !== undefined && limit !== undefined && Number(value) > Number(limit);
}

function classifyRule(rule: string, state: RuleState, shipped: RuleState | undefined): keyof ComparedRules {
    if (shipped?.on !== true) return state.on ? 'added' : 'covered';
    if (!state.on || isWeakerRule(rule, state.options, shipped.options)) return 'weakened';
    return isDeepStrictEqual(state.options, shipped.options) ? 'covered' : 'options';
}

export function convertRule(value: unknown, hasSeverity: boolean): RuleState {
    const [first, ...rest] = [value].flat();
    if (hasSeverity) return { on: first !== 0 && first !== 'off', options: rest };
    if (first === null || first === false) return { on: false, options: [] };
    return { on: true, options: first === true ? rest : [first, ...rest] };
}

/**
Compare the names and options of the rules of a replaced config with what gspot runs. The same rule counts as covered.
A rule that gspot runs with other options carries over, unless the options give a weaker limit. A rule that the user
turned off, or weakened, carries over as an ignore. The caller decides what happens to a rule that gspot does not run.
*/
export function compareRules(input: RuleComparison): ComparedRules {
    const groups = Map.groupBy(input.user, ([rule, state]) => classifyRule(rule, state, input.lookup(rule)));
    return {
        covered: groups.get('covered')?.length ?? 0,
        options: new Map((groups.get('options') ?? []).map(([rule, { options }]) => [rule, options])),
        weakened: (groups.get('weakened') ?? []).map(([rule]) => rule),
        added: (groups.get('added') ?? []).map(([rule]) => rule),
    };
}

/**
Compare the selectors of a Ruff config with the selectors that gspot runs. A selector counts as covered when a selector
of gspot holds it: E5 holds E501, and A holds A001 but no selector of another Ruff plugin. A rule that the config turns
off carries over as an ignore when a shipped or a carried selector holds it.
*/
export function compareRuffRules(input: RuffRuleInput): RuffRules {
    const { path, options, shipped } = input;
    const lint = { ...options, ...options.lint };
    const selected = [...(lint.select ?? []), ...(lint['extend-select'] ?? [])];
    const running = new RegExp(String.raw`^(?:${shipped.join('|')})(?:\d|$)`, 'u');
    const added = selected.filter((rule) => !running.test(rule));
    const rules = added.filter((rule) => RUFF_SELECTOR.test(rule) && !RUFF_IMPORT_ORDER_SELECTOR.test(rule));
    const held = [...shipped, ...rules].join('|').replace(RUFF_ALL_SELECTOR, () => RUFF_ANY_PREFIX);
    const runsAfterInit = new RegExp(String.raw`^(?:${held})(?:\d|$)`, 'u');
    const perFile = [lint['per-file-ignores'], lint['extend-per-file-ignores']].flatMap((table) =>
        table === undefined ? [] : Object.entries(table),
    );
    const turnedOff = [
        ...[...(lint.ignore ?? []), ...(lint['extend-ignore'] ?? [])].map((rule) => ({ rule, file: undefined })),
        ...perFile.flatMap(([file, ignored]) => ignored.map((rule) => ({ rule, file }))),
    ];
    const ignores = turnedOff
        .filter(({ rule }) => runsAfterInit.test(rule))
        .map(({ rule, file }) => ({ rule, file: file === undefined || file.includes('/') ? file : `**/${file}` }));
    const row: CarryoverRow = {
        ...CARRYOVER_ROW_START,
        path,
        tool: 'ruff',
        covered: selected.length - added.length,
        carried: [
            ...rules,
            ...ignores.map(({ rule, file }) => (file === undefined ? `ignore ${rule}` : `ignore ${rule} in ${file}`)),
        ],
        dropped: [
            ...Object.entries({ '': options, 'lint.': options.lint, 'format.': options.format }).flatMap(
                ([prefix, table]) => (table?.dropped ?? []).map((key) => `${prefix}${key}`),
            ),
            ...added.filter((rule) => !rules.includes(rule)),
            ...turnedOff.map(({ rule }) => rule).filter((rule) => !RUFF_SELECTOR.test(rule)),
        ],
    };
    return { rules, ignores, row };
}

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

/**
Read the rules that the ESLint and Stylelint of the repository resolve. Call this before init replaces their configs.
Each tool reads one config, the first in the order of its manifest, which is the order in which the tool looks for
one. The read names the other configs of the tool, whose rules it does not hold.
*/
export async function readUserRules(planning: InitPlanning): Promise<RuleRead[]> {
    const { detection, session } = planning;
    const { root, repository, toolConfigurations } = session;
    const tools = listToolNames(toolConfigurations);
    const reads = PRINTED_RULE_TOOLS.flatMap((definition) => {
        const [config, ...others] = detection.repositorySetup.conflictingConfigs.filter(
            ({ tool, shared, path }) =>
                tool === definition.tool && !shared && IGNORE_FILES.every(({ file }) => posix.basename(path) !== file),
        );
        const sample = repository.files.find(({ path }) => definition.sample.test(path))?.path;
        if (config === undefined || sample === undefined || !tools.has(definition.tool)) return [];
        const { path } = config;
        return [
            { definition, path, others: others.map((other) => other.path), text: findText(root, path) ?? '', sample },
        ];
    });
    return await Promise.all(
        reads.map(async (read) => ({
            ...read,
            user: await readPrintedRules({
                root,
                tool: read.definition.tool,
                search: { folders: [root] },
                commandArguments: [RULE_PRINT_FLAG, read.sample],
                hasSeverity: read.definition.hasSeverity,
            }),
        })),
    );
}

/**
Compare the rules of each replaced config with the rules that the installed tools of gspot resolve. The printed rules
hold the shared configs that the file extends, so only a rule that the file itself names counts: a rule that a shared
config turns off is not the user's choice, and needs no reason. Each other config of a tool gets a row that names the
config the tool read.
*/
export async function compareInstalledRules(root: string, reads: RuleRead[]): Promise<CarryoverRow[]> {
    const unread = reads.flatMap(({ definition: { tool }, path: read, others }) =>
        others.map((path): CarryoverRow => ({
            ...CARRYOVER_ROW_START,
            path,
            tool,
            dropped: [OTHER_CONFIG_MESSAGE.replace('<tool>', () => tool).replace('<path>', () => read)],
        })),
    );
    const compared = await Promise.all(
        reads.map(async ({ definition, path, text, sample, user: printed }): Promise<CarryoverRow> => {
            const user =
                printed &&
                new Map(
                    [...printed].filter(([rule]) =>
                        new RegExp(String.raw`(?:^|[^\w@/-])${escapeRegExp(rule)}(?:[^\w/-]|$)`, 'mu').test(text),
                    ),
                );
            const { tool, check, hasSeverity, gspotArguments } = definition;
            const shipped = await readPrintedRules({
                root,
                tool,
                search: { folders: [], toolFolderKind: 'npm' },
                commandArguments: [...gspotArguments, RULE_PRINT_FLAG, sample],
                hasSeverity,
            });
            if (user === undefined || shipped === undefined)
                return { ...CARRYOVER_ROW_START, path, tool, dropped: [NOT_COMPARED_MESSAGE] };
            const compared = compareRules({ check, user, lookup: (rule) => shipped.get(rule) });
            const prefixes = new Set(shipped.keys().map((rule) => rule.slice(0, rule.lastIndexOf('/') + 1)));
            const added = Map.groupBy(
                compared.added,
                (rule) => rule.includes('/') && !prefixes.has(rule.slice(0, rule.lastIndexOf('/') + 1)),
            );
            return {
                ...CARRYOVER_ROW_START,
                path,
                tool,
                covered: compared.covered,
                differing: [...compared.options].map(([rule, options]) => `${rule} ${JSON.stringify(options)}`),
                reasons: compared.weakened.map(
                    (rule) => `gspot ignore ${check} --rule ${quoteArgument(rule)} --reason ${REASON_PLACEHOLDER}`,
                ),
                plugins: (added.get(true) ?? []).map((rule) => `${rule} ${JSON.stringify(user.get(rule)?.options)}`),
                commandChecks: added.get(false) ?? [],
            };
        }),
    );
    return [...compared, ...unread];
}
