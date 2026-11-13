import { isDeepStrictEqual } from 'node:util';

import { MARKDOWNLINT_PRETTIER_DISABLED } from '#cli/config/configurations/markdown.ts';
import {
    CARRYOVER_ROW_START,
    COMMITLINT_CHECK,
    COMMITLINT_CONFIG_PATH,
    COMMITLINT_TARGET,
    EMPTY_CARRYOVER,
    FIRST_NUMBER,
    IGNORE_REASON_START,
    LIMIT_RULE,
    MARKDOWNLINT_ALIASES,
    MARKDOWNLINT_CHECK,
    MARKDOWNLINT_CONFIG_FILES,
    MARKDOWNLINT_RETIRED_RULES,
    MARKDOWNLINT_RUNNER_FILE,
    MARKDOWNLINT_TARGET,
    PRINT_TIMEOUT_SECONDS,
    UNREADABLE_CONFIG_MESSAGE,
} from '#cli/config/generation/setup.ts';
import { MARKDOWNLINT_RULE_ID } from '#cli/config/settings/tables.ts';
import { buildConfigs } from '#cli/generation/configs/build.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { tryParseFile } from '#cli/parsers/validation.ts';
import { printedRulesSchema } from '#cli/schemas/generation.ts';
import { configTableSchema } from '#cli/schemas/parsers.ts';
import { toolsSchema } from '#cli/schemas/settings/tools.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { isTable } from '#cli/system/tables.ts';
import { listRepositoryExecutablePaths } from '#cli/tools/programs/locate.ts';
import { runTool } from '#cli/tools/run.ts';
import type {
    CarryoverInput,
    CarryoverRow,
    CarryoverSection,
    ComparedRules,
    MarkdownlintConfig,
    PrintedRules,
    RuleComparison,
    RuleState,
    RuleTable,
    ToolCarryoverInput,
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

function splitMarkdownlintTable(path: string, table: Record<string, unknown>): MarkdownlintConfig {
    if (!MARKDOWNLINT_RUNNER_FILE.test(path)) return { path, rules: table, dropped: [] };
    const { config, ...others } = table;
    return { path, rules: isTable(config) ? config : {}, dropped: Object.keys(others) };
}

function readMarkdownlintFile(root: string): MarkdownlintConfig | undefined {
    for (const path of MARKDOWNLINT_CONFIG_FILES) {
        const text = findText(root, path);
        if (text === undefined) continue;
        const parse = path.includes('.json') ? parseJsonFile : parseYamlFile;
        const table = tryParseFile(() => parse(path, text, configTableSchema));
        return table === undefined
            ? { path, rules: {}, dropped: [UNREADABLE_CONFIG_MESSAGE] }
            : splitMarkdownlintTable(path, table);
    }
    return undefined;
}

function parseGeneratedConfig(session: CarryoverInput['session'], target: string): Record<string, unknown> {
    const generated = buildConfigs(session).files.find(({ path }) => path === target);
    return parseJsonFile(target, generated?.content ?? '{}');
}

function buildToolCarryover(input: ToolCarryoverInput): CarryoverSection {
    const { setting, check, tool, path, compared, options, dropped } = input;
    const held = Map.groupBy(
        options,
        ([rule, value]) => toolsSchema.shape[setting].safeParse({ rules: { [rule]: value } }).success,
    );
    const carried = held.get(true) ?? [];
    const row: CarryoverRow = {
        ...CARRYOVER_ROW_START,
        path,
        tool,
        covered: compared.covered,
        carried: [...carried.map(([rule]) => rule), ...compared.weakened.map((rule) => `ignore ${rule}`)],
        dropped: [...dropped, ...compared.added, ...(held.get(false) ?? []).map(([rule]) => rule)],
    };
    const rules = Object.fromEntries(carried);
    const reason = `${IGNORE_REASON_START} ${path}.`;
    return {
        tools: carried.length === 0 ? {} : { [setting]: { rules } },
        ignore: compared.weakened.map((rule) => ({ check, rule, reason })),
        rows: [row],
    };
}

export function convertRule(value: unknown, { hasSeverity }: { hasSeverity: boolean }): RuleState {
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

export async function readPrintedRules(input: PrintedRules): Promise<RuleTable | undefined> {
    const { root, tool, search, commandArguments, hasSeverity } = input;
    const [program] = listRepositoryExecutablePaths(root, tool, search);
    if (program === undefined) return undefined;
    const printed = await runTool([program, ...commandArguments], { cwd: root, timeoutSeconds: PRINT_TIMEOUT_SECONDS });
    if (printed.code !== 0) return undefined;
    try {
        const { rules } = parseJsonFile(tool, printed.stdout, printedRulesSchema);
        return new Map(Object.entries(rules).map(([rule, value]) => [rule, convertRule(value, { hasSeverity })]));
    } catch (error) {
        if (error instanceof GspotError) return undefined;
        throw error;
    }
}

export function readMarkdownlintCarryover({ repository, session, tools }: CarryoverInput): CarryoverSection {
    const found = tools.has('markdownlint-cli2') ? readMarkdownlintFile(repository.root) : undefined;
    if (found === undefined) return EMPTY_CARRYOVER;
    const document = {
        ...Object.fromEntries(MARKDOWNLINT_PRETTIER_DISABLED.map((rule) => [rule, false])),
        ...parseGeneratedConfig(session, MARKDOWNLINT_TARGET),
    };
    const rules = Object.entries(found.rules).map(
        ([rule, value]) => [MARKDOWNLINT_ALIASES[rule] ?? rule, value] as const,
    );
    const user: RuleTable = new Map(
        rules
            .filter(([rule]) => MARKDOWNLINT_RULE_ID.test(rule))
            .map(([rule, value]) => [rule, convertRule(value, { hasSeverity: false })]),
    );
    const compared = compareRules({
        check: MARKDOWNLINT_CHECK,
        user,
        lookup: (rule) =>
            MARKDOWNLINT_RETIRED_RULES.has(rule)
                ? undefined
                : convertRule(document[rule] ?? true, { hasSeverity: false }),
    });
    return buildToolCarryover({
        setting: 'markdownlint',
        check: MARKDOWNLINT_CHECK,
        tool: 'markdownlint-cli2',
        path: found.path,
        compared,
        options: new Map([...compared.options].map(([rule, [table]]) => [rule, table])),
        dropped: [...found.dropped, ...rules.map(([rule]) => rule).filter((rule) => !MARKDOWNLINT_RULE_ID.test(rule))],
    });
}

export async function readCommitlintCarryover({
    repository,
    session,
    tools,
}: CarryoverInput): Promise<CarryoverSection> {
    const config = repository.files.find(({ path }) => COMMITLINT_CONFIG_PATH.test(path));
    if (config === undefined || !tools.has('commitlint')) return EMPTY_CARRYOVER;
    const user = await readPrintedRules({
        root: repository.root,
        tool: 'commitlint',
        search: { folders: [repository.root] },
        commandArguments: ['--print-config', 'json'],
        hasSeverity: true,
    });
    if (user === undefined) return EMPTY_CARRYOVER;
    const shipped = parseGeneratedConfig(session, COMMITLINT_TARGET)['rules'] as Record<string, readonly unknown[]>;
    const compared = compareRules({
        check: COMMITLINT_CHECK,
        user,
        lookup: (rule) => (shipped[rule] === undefined ? undefined : convertRule(shipped[rule], { hasSeverity: true })),
    });
    return buildToolCarryover({
        setting: 'commitlint',
        check: COMMITLINT_CHECK,
        tool: 'commitlint',
        path: config.path,
        compared,
        options: compared.options,
        dropped: [],
    });
}
