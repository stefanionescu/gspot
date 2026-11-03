import { posix } from 'node:path';
import { isTable } from '#cli/system/tables.ts';
import { tryParseFile } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { configTableSchema } from '#cli/schemas/parsers.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { toolsSchema } from '#cli/schemas/settings/tools.ts';
import { EDITORCONFIG_FILE } from '#cli/config/generation.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { MARKDOWNLINT_RULE_ID } from '#cli/config/settings/schema.ts';
import { listUnparsedCiFiles } from '#cli/repository/lint-commands.ts';
import { readPyrightCarryover } from '#cli/generation/setup/pyright.ts';
import { listUnparsedDependencyFiles } from '#cli/repository/dependencies.ts';
import { MARKDOWNLINT_PRETTIER_DISABLED } from '#cli/config/configurations/language.ts';
import { readIgnoreFiles, convertIgnorePattern } from '#cli/generation/setup/ignore-files.ts';
import { readRuffOptions, readPrettierOptions, buildPrettierOverrides } from '#cli/generation/setup/format.ts';
import { convertRule, compareRules, compareRuffRules, readPrintedRules } from '#cli/generation/setup/lint-rules.ts';

import type {
    Carryover,
    RuleTable,
    CarryoverRow,
    CarryoverInput,
    CarryoverSection,
    ToolCarryoverInput,
    MarkdownlintConfig,
} from '#cli/types/generation.ts';
import {
    CARRIED_TOOLS,
    RUFF_CHECK,
    RUFF_CHECK_IDS,
    EMPTY_CARRYOVER,
    RUFF_STYLE_KEYS,
    RUFF_FORMAT_KEYS,
    COMMITLINT_TARGET,
    PRINTED_RULE_TOOLS,
    SCAN_FIRST_MESSAGE,
    CARRYOVER_ROW_START,
    COMMITLINT_CHECK_ID,
    IGNORE_REASON_START,
    MARKDOWNLINT_TARGET,
    MARKDOWNLINT_ALIASES,
    PRETTIER_EXCLUDE_KEY,
    UNREAD_CONFIG_MESSAGE,
    MARKDOWNLINT_CHECK_ID,
    COMMITLINT_CONFIG_PATH,
    PRETTIER_OVERRIDES_KEY,
    MARKDOWNLINT_RUNNER_FILE,
    MARKDOWNLINT_CONFIG_FILES,
    UNREADABLE_CONFIG_MESSAGE,
    MARKDOWNLINT_RETIRED_RULES,
} from '#cli/config/repository/setup.ts';

function readRuffCarryover(input: CarryoverInput): CarryoverSection {
    const { repository, tools, configurations, level } = input;
    const found = tools.has('ruff') ? readRuffOptions(repository.root) : undefined;
    if (found === undefined) return EMPTY_CARRYOVER;
    const { path, options } = found;
    const shipped = configurations.flatMap(({ ruff }) => [...ruff.basic, ...(level === 'all' ? ruff.all : [])]);
    const { rules, ignores, row } = compareRuffRules({ path, options, shipped });
    const tracked = repository.files.map((file) => file.path);
    const excludes = [...(options.exclude ?? []), ...(options['extend-exclude'] ?? [])];
    const paths = excludes.flatMap((pattern) => convertIgnorePattern(pattern, '', tracked) ?? []);
    const reason = `${IGNORE_REASON_START} ${path}.`;
    const format = [
        ...RUFF_FORMAT_KEYS.filter((key) => options[key] !== undefined),
        ...RUFF_STYLE_KEYS.filter((key) => options.format?.[key] !== undefined).map((key) => `format.${key}`),
    ];
    return {
        tools: rules.length === 0 ? {} : { ruff: { rules } },
        ignore: [
            ...(paths.length === 0 ? [] : RUFF_CHECK_IDS.map((check) => ({ check, paths, reason }))),
            ...ignores.map(({ rule, file }) => ({
                check: RUFF_CHECK,
                rule,
                ...(file !== undefined && { paths: [file] }),
                reason,
            })),
        ],
        rows: [{ ...row, carried: [...row.carried, ...format, ...paths] }],
    };
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

function readGeneratedFile(session: CarryoverInput['session'], target: string): Record<string, unknown> {
    const generated = buildGeneratedFiles(session).files.find(({ path }) => path === target);
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

function readMarkdownlintCarryover({ repository, session, tools }: CarryoverInput): CarryoverSection {
    const found = tools.has('markdownlint-cli2') ? readMarkdownlintFile(repository.root) : undefined;
    if (found === undefined) return EMPTY_CARRYOVER;
    const document = {
        ...Object.fromEntries(MARKDOWNLINT_PRETTIER_DISABLED.map((rule) => [rule, false])),
        ...readGeneratedFile(session, MARKDOWNLINT_TARGET),
    };
    const rules = Object.entries(found.rules).map(
        ([rule, value]) => [MARKDOWNLINT_ALIASES[rule] ?? rule, value] as const,
    );
    const user: RuleTable = new Map(
        rules
            .filter(([rule]) => MARKDOWNLINT_RULE_ID.test(rule))
            .map(([rule, value]) => [rule, convertRule(value, false)]),
    );
    const compared = compareRules({
        check: MARKDOWNLINT_CHECK_ID,
        user,
        lookup: (rule) =>
            MARKDOWNLINT_RETIRED_RULES.has(rule) ? undefined : convertRule(document[rule] ?? true, false),
    });
    return buildToolCarryover({
        setting: 'markdownlint',
        check: MARKDOWNLINT_CHECK_ID,
        tool: 'markdownlint-cli2',
        path: found.path,
        compared,
        options: new Map([...compared.options].map(([rule, [table]]) => [rule, table])),
        dropped: [...found.dropped, ...rules.map(([rule]) => rule).filter((rule) => !MARKDOWNLINT_RULE_ID.test(rule))],
    });
}

async function readCommitlintCarryover({ repository, session, tools }: CarryoverInput): Promise<CarryoverSection> {
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
    const shipped = readGeneratedFile(session, COMMITLINT_TARGET)['rules'] as Record<string, readonly unknown[]>;
    const compared = compareRules({
        check: COMMITLINT_CHECK_ID,
        user,
        lookup: (rule) => (shipped[rule] === undefined ? undefined : convertRule(shipped[rule], true)),
    });
    return buildToolCarryover({
        setting: 'commitlint',
        check: COMMITLINT_CHECK_ID,
        tool: 'commitlint',
        path: config.path,
        compared,
        options: compared.options,
        dropped: [],
    });
}

function listUncomparedRows({ conflictingConfigs, tools }: CarryoverInput): CarryoverRow[] {
    return PRINTED_RULE_TOOLS.flatMap(({ tool }) =>
        conflictingConfigs
            .filter((config) => config.tool === tool && !config.shared && tools.has(tool))
            .map(({ path }) => ({ ...CARRYOVER_ROW_START, path, tool, dropped: [SCAN_FIRST_MESSAGE] })),
    );
}

function listUnreadRows({ conflictingConfigs, tools }: CarryoverInput, rows: CarryoverRow[]): CarryoverRow[] {
    const read = new Set(rows.map(({ path }) => path));
    const unread = conflictingConfigs.filter(
        ({ path, tool }) => CARRIED_TOOLS.has(tool) && tools.has(tool) && !read.has(path),
    );
    return [...new Map(unread.map(({ path, tool }) => [path, tool]))].map(([path, tool]) => ({
        ...CARRYOVER_ROW_START,
        path,
        tool,
        dropped: [UNREAD_CONFIG_MESSAGE],
    }));
}

function listPrettierRows({
    repository,
    session,
    prettierScripts,
    trackedPaths,
    tools,
}: CarryoverInput): CarryoverRow[] {
    if (!tools.has('prettier')) return [];
    return session.scopes.flatMap(({ path: scope }) => {
        const sources = readPrettierOptions(repository.root, scope, prettierScripts);
        const readPath = sources[0]?.path;
        const readKeys = new Set(sources.slice(0, 1).flatMap(({ options }) => Object.keys(options)));
        return sources.map(({ path, options }) => {
            const { dropped, overrides, ...style } = options;
            const inOverrides = (overrides ?? []).flatMap((override) => [
                ...override.options.dropped,
                ...(override.excludeFiles === undefined ? [] : [PRETTIER_EXCLUDE_KEY]),
            ]);
            const keys = Object.keys(style);
            const held = new Set(
                [...keys, PRETTIER_OVERRIDES_KEY].filter(
                    (key) => path === readPath || (posix.basename(path) === EDITORCONFIG_FILE && !readKeys.has(key)),
                ),
            );
            const isOverridden =
                held.has(PRETTIER_OVERRIDES_KEY) && buildPrettierOverrides(options, scope, trackedPaths).length > 0;
            return {
                ...CARRYOVER_ROW_START,
                path,
                tool: 'prettier',
                carried: [...keys.filter((key) => held.has(key)), ...(isOverridden ? [PRETTIER_OVERRIDES_KEY] : [])],
                dropped: [...new Set([...dropped, ...inOverrides, ...keys.filter((key) => !held.has(key))])],
            };
        });
    });
}

/**
Read what init carries from the configs it replaces: ignore files, the rules of Ruff, markdownlint, and commitlint, and
the options of Prettier, which the format table holds.

@param input the repository, the tools that run, and the session of the settings so far.
@returns the part of gspot.toml to add, and one row per replaced config.
*/
export async function readCarryover(input: CarryoverInput): Promise<Carryover> {
    const sections = [
        { ...EMPTY_CARRYOVER, rows: [...listPrettierRows(input), ...listUncomparedRows(input)] },
        readIgnoreFiles(input),
        readRuffCarryover(input),
        readPyrightCarryover(input),
        readMarkdownlintCarryover(input),
        await readCommitlintCarryover(input),
        {
            ...EMPTY_CARRYOVER,
            rows: [
                ...listUnparsedDependencyFiles(input.repository.files, input.repository.dependencyFiles),
                ...listUnparsedCiFiles(input.repository),
            ].map((path) => ({ ...CARRYOVER_ROW_START, path, tool: 'gspot', dropped: [UNREADABLE_CONFIG_MESSAGE] })),
        },
    ];
    const rows = sections.flatMap((section) => section.rows);
    const tools = Object.fromEntries(sections.flatMap((section) => Object.entries(section.tools)));
    const ignore = [...input.templateIgnore, ...sections.flatMap((section) => section.ignore)];
    return {
        settings: {
            ...(Object.keys(tools).length > 0 && { tools }),
            ...(ignore.length > 0 && { ignore }),
        },
        rows: [...rows, ...listUnreadRows(input, rows)],
    };
}
