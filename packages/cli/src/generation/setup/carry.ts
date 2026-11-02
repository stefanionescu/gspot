import { posix } from 'node:path';
import { joinScope } from '#cli/repository/scopes.ts';
import { findText } from '#cli/system/files/reads.ts';
import { TRAILING_SLASH } from '#cli/config/system.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { getTable, getRootScope } from '#cli/settings/scopes.ts';
import { LINE_BREAK, GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { MARKDOWNLINT_RULE_ID } from '#cli/config/settings/schema.ts';
import { COMMITLINT_ERROR_SEVERITY } from '#cli/config/configurations/general.ts';
import { readRuffOptions, readPrettierOptions } from '#cli/generation/setup/format.ts';
import { convertRule, compareRules, compareRuffRules, readPrintedRules } from '#cli/generation/setup/lint-rules.ts';
import type { Carry, CarryRow, RuleTable, CarryInput, CarrySection, ToolCarryInput } from '#cli/types/generation.ts';

import {
    EMPTY_CARRY,
    IGNORE_FILES,
    LEADING_SLASH,
    RUFF_CHECK_IDS,
    COMMENT_PATTERN,
    CARRY_ROW_START,
    PRINTED_RULE_TOOLS,
    SCAN_FIRST_MESSAGE,
    COMMITLINT_CHECK_ID,
    IGNORE_REASON_START,
    MARKDOWNLINT_TARGET,
    MARKDOWNLINT_CHECK_ID,
    COMMITLINT_CONFIG_PATH,
    CARRIED_PRETTIER_OPTIONS,
    MARKDOWNLINT_CONFIG_FILES,
} from '#cli/config/repository/setup.ts';

function convertIgnorePattern(pattern: string, folder: string, tracked: string[]): string | undefined {
    const inFolder = tracked.filter((path) => folder === '' || path.startsWith(`${folder}/`));
    const base = pattern.replace(LEADING_SLASH, '').replace(TRAILING_SLASH, '');
    const anchored = pattern.slice(0, -1).includes('/');
    const glob = joinScope(folder, anchored ? base : `**/${base}`);
    return [glob, `${glob}/**`].find((selector) => {
        const matches = buildPathMatcher([selector]);
        return inFolder.some((path) => matches(path));
    });
}

function convertIgnoreFile(path: string, text: string, tracked: string[]): { paths: string[]; dropped: string[] } {
    const folder = posix.dirname(path) === '.' ? '' : posix.dirname(path);
    const patterns = text
        .split(LINE_BREAK)
        .map((line) => line.trim())
        .filter((line) => line !== '' && !COMMENT_PATTERN.test(line));
    const kept = patterns.filter((pattern) => !pattern.startsWith('!'));
    const paths = kept.flatMap((pattern) => convertIgnorePattern(pattern, folder, tracked) ?? []);
    return { paths: [...new Set(paths)], dropped: patterns.filter((pattern) => pattern.startsWith('!')) };
}

function readIgnoreFiles({ repository, tools }: CarryInput): CarrySection {
    const tracked = repository.files.filter(({ path }) => !path.startsWith(`${GSPOT_FOLDER}/`)).map(({ path }) => path);
    const owned = IGNORE_FILES.filter(({ tool }) => tools.has(tool)).flatMap(({ file, tool, check }) =>
        tracked
            .filter((path) => posix.basename(path) === file)
            .map((path) => ({ path, tool, check, text: findText(repository.root, path) ?? '' })),
    );
    const converted = owned.map((each) => ({ ...each, ...convertIgnoreFile(each.path, each.text, tracked) }));
    return {
        tools: {},
        ignore: converted
            .filter(({ paths }) => paths.length > 0)
            .map(({ path, paths, check }) => ({ check, paths, reason: `${IGNORE_REASON_START} ${path}.` })),
        rows: converted.map(({ path, tool, paths, dropped }) => ({
            ...CARRY_ROW_START,
            path,
            tool,
            carried: paths,
            dropped,
        })),
    };
}

function readRuffCarry(input: CarryInput): CarrySection {
    const { repository, tools, configurations, level } = input;
    const found = tools.has('ruff') ? readRuffOptions(repository.root) : undefined;
    if (found === undefined) return EMPTY_CARRY;
    const { path, options } = found;
    const shipped = configurations.flatMap(({ ruff }) => [...ruff.basic, ...(level === 'all' ? ruff.all : [])]);
    const { rules, row } = compareRuffRules({ path, options, shipped });
    const tracked = repository.files.map((file) => file.path);
    const excludes = [...(options.exclude ?? []), ...(options['extend-exclude'] ?? [])];
    const paths = excludes.flatMap((pattern) => convertIgnorePattern(pattern, '', tracked) ?? []);
    const reason = `${IGNORE_REASON_START} ${path}.`;
    return {
        tools: rules.length === 0 ? {} : { ruff: { rules } },
        ignore: paths.length === 0 ? [] : RUFF_CHECK_IDS.map((check) => ({ check, paths, reason })),
        rows: [{ ...row, carried: [...row.carried, ...paths] }],
    };
}

function readMarkdownlintFile(root: string): { path: string; rules: Record<string, unknown> } | undefined {
    for (const path of MARKDOWNLINT_CONFIG_FILES) {
        const text = findText(root, path);
        if (text === undefined) continue;
        const table = (path.includes('.json') ? parseJsonFile(path, text) : parseYamlFile(path, text)) as Record<
            string,
            unknown
        >;
        return { path, rules: (path.includes('cli2') ? table['config'] : table) as Record<string, unknown> };
    }
    return undefined;
}

function buildToolCarry({ setting, tool, path, compared, options }: ToolCarryInput): CarrySection {
    const row: CarryRow = {
        ...CARRY_ROW_START,
        path,
        tool,
        covered: compared.covered,
        carried: [...options.keys()],
        reasons: compared.reasons,
        dropped: compared.added,
    };
    const rules = Object.fromEntries(options);
    return { tools: options.size === 0 ? {} : { [setting]: { rules } }, ignore: [], rows: [row] };
}

function readMarkdownlintCarry({ repository, session, tools }: CarryInput): CarrySection {
    const found = tools.has('markdownlint-cli2') ? readMarkdownlintFile(repository.root) : undefined;
    if (found === undefined) return EMPTY_CARRY;
    const generated = buildGeneratedFiles(session).files.find(({ path }) => path === MARKDOWNLINT_TARGET);
    const document = parseJsonFile(MARKDOWNLINT_TARGET, generated?.content ?? '{}');
    const user: RuleTable = new Map(
        Object.entries(found.rules)
            .filter(([rule]) => MARKDOWNLINT_RULE_ID.test(rule))
            .map(([rule, value]) => [rule, convertRule(value, false)]),
    );
    const compared = compareRules({
        check: MARKDOWNLINT_CHECK_ID,
        user,
        lookup: (rule) => convertRule(document[rule] ?? true, false),
    });
    return buildToolCarry({
        setting: 'markdownlint',
        tool: 'markdownlint-cli2',
        path: found.path,
        compared,
        options: new Map([...compared.options].map(([rule, [table]]) => [rule, table])),
    });
}

async function readCommitlintCarry({ repository, session, tools }: CarryInput): Promise<CarrySection> {
    const config = repository.files.find(({ path }) => COMMITLINT_CONFIG_PATH.test(path));
    if (config === undefined || !tools.has('commitlint')) return EMPTY_CARRY;
    const user = await readPrintedRules({
        root: repository.root,
        tool: 'commitlint',
        search: { folders: [repository.root] },
        commandArguments: ['--print-config', 'json'],
        hasSeverity: true,
    });
    if (user === undefined) return EMPTY_CARRY;
    const commits = getTable(getRootScope(session.scopes).settings, 'commits');
    const configuration = session.toolConfigurations.find(({ name }) => name === 'commits');
    const shipped: Record<string, readonly unknown[]> = {
        ...configuration?.commitlint.rules,
        'type-enum': [COMMITLINT_ERROR_SEVERITY, 'always', commits.types],
    };
    const compared = compareRules({
        check: COMMITLINT_CHECK_ID,
        user,
        lookup: (rule) => (shipped[rule] === undefined ? undefined : convertRule(shipped[rule], true)),
    });
    return buildToolCarry({
        setting: 'commitlint',
        tool: 'commitlint',
        path: config.path,
        compared,
        options: compared.options,
    });
}

function listUncomparedRows({ conflictingConfigs, tools }: CarryInput): CarryRow[] {
    return PRINTED_RULE_TOOLS.flatMap(({ tool }) =>
        conflictingConfigs
            .filter((config) => config.tool === tool && !config.shared && tools.has(tool))
            .map(({ path }) => ({ ...CARRY_ROW_START, path, tool, dropped: [SCAN_FIRST_MESSAGE] })),
    );
}

function listPrettierRows({ repository, prettierScripts, tools }: CarryInput): CarryRow[] {
    return tools.has('prettier')
        ? readPrettierOptions(repository.root, prettierScripts).map(({ path, options }) => ({
              ...CARRY_ROW_START,
              path,
              tool: 'prettier',
              carried: Object.keys(options).filter((key) => CARRIED_PRETTIER_OPTIONS.has(key)),
              dropped: Object.keys(options).filter((key) => !CARRIED_PRETTIER_OPTIONS.has(key)),
          }))
        : [];
}

/**
Read what init carries from the configs it replaces: ignore files, the rules of Ruff, markdownlint, and commitlint, and
the options of Prettier, which the format table holds.

@param input the repository, the tools that run, and the session of the settings so far.
@returns the part of gspot.toml to add, and one row per replaced config.
*/
export async function readCarry(input: CarryInput): Promise<Carry> {
    const sections = [
        { ...EMPTY_CARRY, rows: [...listPrettierRows(input), ...listUncomparedRows(input)] },
        readIgnoreFiles(input),
        readRuffCarry(input),
        readMarkdownlintCarry(input),
        await readCommitlintCarry(input),
    ];
    const tools = Object.fromEntries(sections.flatMap((section) => Object.entries(section.tools)));
    const ignore = [...input.templateIgnore, ...sections.flatMap((section) => section.ignore)];
    return {
        settings: {
            ...(Object.keys(tools).length > 0 && { tools }),
            ...(ignore.length > 0 && { ignore }),
        },
        rows: sections.flatMap((section) => section.rows),
    };
}
