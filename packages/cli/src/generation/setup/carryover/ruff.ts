import { RUFF_CHECK } from '#cli/config/configurations/python.ts';
import {
    CARRYOVER_ROW_START,
    EMPTY_CARRYOVER,
    IGNORE_REASON_START,
    RUFF_ALL_SELECTOR,
    RUFF_ANY_PREFIX,
    RUFF_CHECK_IDS,
    RUFF_FORMAT_KEYS,
    RUFF_STYLE_KEYS,
} from '#cli/config/generation/setup.ts';
import { RUFF_IMPORT_ORDER_SELECTOR, RUFF_SELECTOR } from '#cli/config/settings/schema.ts';
import { convertIgnorePattern } from '#cli/generation/setup/carryover/ignore-files.ts';
import { readRuffOptions } from '#cli/generation/setup/format/overrides.ts';
import type {
    CarryoverInput,
    CarryoverRow,
    CarryoverSection,
    RuffRuleInput,
    RuffRules,
} from '#cli/types/generation.ts';

/**
Compare the selectors of a Ruff config with the selectors that gspot runs. A selector counts as covered when a selector
of gspot holds it: E5 holds E501, and A holds A001 but no selector of another Ruff plugin. A rule that the config turns
off carries over as an ignore when a shipped or a carried selector holds it.
*/
function compareRuffRules(input: RuffRuleInput): RuffRules {
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

export function readRuffCarryover(input: CarryoverInput): CarryoverSection {
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
