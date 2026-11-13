import { NEGATED_PATTERN } from '#cli/config/configurations/gspot.ts';
import { BASEDPYRIGHT_CHECK } from '#cli/config/configurations/python.ts';
import { PYRIGHT_CONFIG_FILE } from '#cli/config/generation/files.ts';
import {
    CARRYOVER_ROW_START,
    EMPTY_CARRYOVER,
    IGNORE_REASON_START,
    PYRIGHT_TABLES,
} from '#cli/config/generation/setup.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects.ts';
import { TRAILING_SLASH } from '#cli/config/system.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { tryParseFile } from '#cli/parsers/validation.ts';
import { pyrightProjectSchema, pyrightScopeSchema } from '#cli/schemas/generation.ts';
import { findText } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import type { CarryoverInput, CarryoverSection } from '#cli/types/generation.ts';

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
*/
export function readPyrightCarryover({ repository, tools, trackedPaths }: CarryoverInput): CarryoverSection {
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
              ].filter((selector) => trackedPaths.some(buildPathMatcher([selector.replace(NEGATED_PATTERN, '')])));
    const excluded = listExcludedPaths(found.exclude, tracked);
    const paths = [...unchecked, ...excluded];
    return {
        tools: {},
        ignore: [unchecked, excluded]
            .filter((list) => list.length > 0)
            .map((list) => ({
                check: BASEDPYRIGHT_CHECK,
                paths: list,
                reason: `${IGNORE_REASON_START} ${found.path}.`,
            })),
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
