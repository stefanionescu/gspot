import { z } from 'zod';

import { PYPROJECT_TOML } from '#cli/config/parsers.ts';
import { CARRYOVER_ROW_START, EMPTY_CARRYOVER, IGNORE_REASON_START } from '#cli/config/repository/setup.ts';
import { TRAILING_SLASH } from '#cli/config/system.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { tryParseFile } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { CarryoverInput, CarryoverSection } from '#cli/types/generation.ts';

const PYRIGHT_CHECK_ID = 'python/basedpyright';

const PYRIGHT_CONFIG_FILE = 'pyrightconfig.json';

const PYRIGHT_TABLES = ['basedpyright', 'pyright'] as const;

const pyrightScopeSchema = z.looseObject({
    include: z.string().array().default([]),
    exclude: z.string().array().default([]),
    typeCheckingMode: z.string().optional(),
});

const pyrightProjectSchema = z.looseObject({
    tool: z
        .looseObject({ basedpyright: pyrightScopeSchema.optional(), pyright: pyrightScopeSchema.optional() })
        .optional(),
});

function readPyrightOptions(
    root: string,
): { path: string; include: string[]; exclude: string[]; typeCheckingMode?: string | undefined } | undefined {
    const config = findText(root, PYRIGHT_CONFIG_FILE);
    if (config !== undefined) {
        const options = tryParseFile(() => parseJsonFile(PYRIGHT_CONFIG_FILE, config, pyrightScopeSchema));
        return options === undefined ? undefined : { path: PYRIGHT_CONFIG_FILE, ...options };
    }
    const project = findText(root, PYPROJECT_TOML);
    if (project === undefined) return undefined;
    const tables = tryParseFile(() => parseTomlFile(PYPROJECT_TOML, project, pyrightProjectSchema))?.tool;
    const options = PYRIGHT_TABLES.map((table) => tables?.[table]).find((table) => table !== undefined);
    return options === undefined ? undefined : { path: PYPROJECT_TOML, ...options };
}

/**
List the selectors of the paths that a pyright exclude names: a tracked file as it is, and a folder with its contents.

@param exclude the paths that pyright leaves out.
@param tracked the tracked files.
*/
function listExcludedPaths(exclude: string[], tracked: string[]): string[] {
    return exclude.flatMap((path) => {
        const base = path.replace(TRAILING_SLASH, '');
        const selector = tracked.includes(base) ? base : `${base}/**`;
        const isMatched = buildPathMatcher([selector]);
        return tracked.some((file) => isMatched(file)) ? [selector] : [];
    });
}

/**
Carry the include and exclude of a pyright config as paths that basedpyright leaves out, so a project that type checks
only its package keeps its tests out of the check.

@param input the repository and the tools in use.
@param input.repository the tracked files and the root.
@param input.tools the tools that the configurations run.
*/
export function readPyrightCarryover({ repository, tools }: CarryoverInput): CarryoverSection {
    const found = tools.has('basedpyright') ? readPyrightOptions(repository.root) : undefined;
    if (found === undefined) return EMPTY_CARRYOVER;
    const tracked = repository.files.map((file) => file.path);
    const unchecked =
        found.include.length === 0
            ? []
            : [
                  '**/*.py',
                  '**/*.pyi',
                  ...found.include.flatMap((path) => {
                      const base = path.replace(TRAILING_SLASH, '');
                      return [`!${base}`, `!${base}/**`];
                  }),
              ];
    const excluded = listExcludedPaths(found.exclude, tracked);
    const paths = [...unchecked, ...excluded];
    return {
        tools: {},
        ignore: [unchecked, excluded]
            .filter((list) => list.length > 0)
            .map((list) => ({ check: PYRIGHT_CHECK_ID, paths: list, reason: `${IGNORE_REASON_START} ${found.path}.` })),
        rows: [
            {
                ...CARRYOVER_ROW_START,
                path: found.path,
                tool: 'basedpyright',
                carried: paths,
                dropped: found.typeCheckingMode === undefined ? [] : ['typeCheckingMode'],
            },
        ],
    };
}
