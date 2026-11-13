import { posix } from 'node:path';

import {
    CARRIED_TOOLS,
    CARRYOVER_ROW_START,
    EDITORCONFIG_FILE,
    EDITORCONFIG_WORDS,
    EMPTY_CARRYOVER,
    PRETTIER_EXCLUDE_KEY,
    PRETTIER_OVERRIDES_KEY,
    PRINTED_RULE_TOOLS,
    SCAN_FIRST_MESSAGE,
    UNREAD_CONFIG_MESSAGE,
    UNREAD_TYPOS_MESSAGE,
    UNREADABLE_CONFIG_MESSAGE,
} from '#cli/config/generation/setup.ts';
import { readIgnoreFiles } from '#cli/generation/setup/carryover/ignore-files.ts';
import { readPyrightCarryover } from '#cli/generation/setup/carryover/pyright.ts';
import { readRuffCarryover } from '#cli/generation/setup/carryover/ruff.ts';
import { readCommitlintCarryover, readMarkdownlintCarryover } from '#cli/generation/setup/carryover/rules.ts';
import {
    buildPrettierOverrides,
    parsePrettierFile,
    readPrettierOptions,
} from '#cli/generation/setup/format/prettier.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { listUnparsedDependencyFiles } from '#cli/repository/projects/dependencies.ts';
import { listUnparsedCiFiles } from '#cli/repository/setup/lint-commands.ts';
import { findText } from '#cli/system/files/reads.ts';
import type { Carryover, CarryoverInput, CarryoverRow } from '#cli/types/generation.ts';

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
