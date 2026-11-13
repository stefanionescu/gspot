import { posix } from 'node:path';

import { MARKDOWNLINT_PRETTIER_DISABLED } from '#cli/config/configurations/markdown.ts';
import { RUFF_CHECK } from '#cli/config/configurations/python.ts';
import {
    CARRIED_TOOLS,
    CARRYOVER_ROW_START,
    COMMITLINT_CHECK,
    COMMITLINT_CONFIG_PATH,
    COMMITLINT_TARGET,
    EDITORCONFIG_FILE,
    EDITORCONFIG_WORDS,
    EMPTY_CARRYOVER,
    IGNORE_REASON_START,
    MARKDOWNLINT_ALIASES,
    MARKDOWNLINT_CHECK,
    MARKDOWNLINT_CONFIG_FILES,
    MARKDOWNLINT_RETIRED_RULES,
    MARKDOWNLINT_RUNNER_FILE,
    MARKDOWNLINT_TARGET,
    PRETTIER_EXCLUDE_KEY,
    PRETTIER_OVERRIDES_KEY,
    PRINTED_RULE_TOOLS,
    RUFF_CHECK_IDS,
    RUFF_FORMAT_KEYS,
    RUFF_STYLE_KEYS,
    SCAN_FIRST_MESSAGE,
    UNREAD_CONFIG_MESSAGE,
    UNREAD_TYPOS_MESSAGE,
    UNREADABLE_CONFIG_MESSAGE,
} from '#cli/config/generation/setup.ts';
import { MARKDOWNLINT_RULE_ID } from '#cli/config/settings/schema.ts';
import { buildConfigs } from '#cli/generation/configs.ts';
import { convertIgnorePattern, readIgnoreFiles } from '#cli/generation/setup/carryover/ignore-files.ts';
import {
    compareRuffRules,
    compareRules,
    convertRule,
    readPrintedRules,
} from '#cli/generation/setup/carryover/lint-rules.ts';
import { readPyrightCarryover } from '#cli/generation/setup/carryover/pyright.ts';
import {
    buildPrettierOverrides,
    parsePrettierFile,
    readPrettierOptions,
    readRuffOptions,
} from '#cli/generation/setup/format.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { tryParseFile } from '#cli/parsers/validation.ts';
import { listUnparsedDependencyFiles } from '#cli/repository/dependencies.ts';
import { listUnparsedCiFiles } from '#cli/repository/lint-commands.ts';
import { configTableSchema } from '#cli/schemas/parsers.ts';
import { toolsSchema } from '#cli/schemas/settings/tools.ts';
import { findText } from '#cli/system/files/reads.ts';
import { isTable } from '#cli/system/tables.ts';
import type {
    Carryover,
    CarryoverInput,
    CarryoverRow,
    CarryoverSection,
    MarkdownlintConfig,
    RuleTable,
    ToolCarryoverInput,
} from '#cli/types/generation.ts';

function readRuffCarryover(input: CarryoverInput): CarryoverSection {
    const { repository, tools, session } = input;
    const { level } = session.settings;
    const found = tools.has('ruff') ? readRuffOptions(repository.root) : undefined;
    if (found === undefined) return EMPTY_CARRYOVER;
    const { path, options } = found;
    const shipped = session.toolConfigurations.flatMap(({ ruff }) => [
        ...ruff.basic,
        ...(level === 'all' ? ruff.all : []),
    ]);
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

function readMarkdownlintCarryover({ repository, session, tools }: CarryoverInput): CarryoverSection {
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

function listUncomparedRows({ conflictingConfigs, tools }: CarryoverInput): CarryoverRow[] {
    return PRINTED_RULE_TOOLS.flatMap(({ tool }) =>
        conflictingConfigs
            .filter((config) => config.tool === tool && !config.shared && tools.has(tool))
            .map(({ path }) => ({ ...CARRYOVER_ROW_START, path, tool, dropped: [SCAN_FIRST_MESSAGE] })),
    );
}

function listUnreadRows(input: CarryoverInput, rows: CarryoverRow[]): CarryoverRow[] {
    const { conflictingConfigs, tools, repository, prettierScripts } = input;
    const read = new Set(rows.map(({ path }) => path));
    const unread = conflictingConfigs.filter(
        ({ path, tool }) => CARRIED_TOOLS.has(tool) && tools.has(tool) && !read.has(path),
    );
    return [...new Map(unread.map(({ path, tool }) => [path, tool]))].map(([path, tool]) => {
        const isUnreadable =
            tool === 'prettier' &&
            parsePrettierFile(path, findText(repository.root, path) ?? '', prettierScripts) === undefined;
        let dropped = UNREAD_CONFIG_MESSAGE;
        if (isUnreadable) dropped = UNREADABLE_CONFIG_MESSAGE;
        else if (tool === 'typos') dropped = UNREAD_TYPOS_MESSAGE;
        return { ...CARRYOVER_ROW_START, path, tool, dropped: [dropped] };
    });
}

function useEditorconfigWords(row: CarryoverRow): CarryoverRow {
    if (posix.basename(row.path) !== EDITORCONFIG_FILE) return row;
    return {
        ...row,
        carried: row.carried.map((key) => EDITORCONFIG_WORDS[key] ?? key),
        dropped: row.dropped.map((key) => EDITORCONFIG_WORDS[key] ?? key),
    };
}

function listPrettierRows(input: CarryoverInput): CarryoverRow[] {
    const { repository, session, prettierScripts, trackedPaths, tools } = input;
    if (!tools.has('prettier')) return [];
    const prettierFiles = getTool(readConfigurations().values(), 'prettier').replace as string[];
    return session.scopes.flatMap(({ path: scopePath }) => {
        const sources = readPrettierOptions(repository.root, scopePath, prettierScripts, prettierFiles);
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
                held.has(PRETTIER_OVERRIDES_KEY) && buildPrettierOverrides(options, scopePath, trackedPaths).length > 0;
            return useEditorconfigWords({
                ...CARRYOVER_ROW_START,
                path,
                tool: 'prettier',
                carried: [...keys.filter((key) => held.has(key)), ...(isOverridden ? [PRETTIER_OVERRIDES_KEY] : [])],
                dropped: [...new Set([...dropped, ...inOverrides, ...keys.filter((key) => !held.has(key))])],
            });
        });
    });
}

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
