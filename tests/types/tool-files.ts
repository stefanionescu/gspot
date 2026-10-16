import type { Config } from 'stylelint';

/** Ruff options for generation tests of levels and scoped settings. */
export type RuffToolFile = {
    lint: { select: string[]; pylint: { 'max-statements': number }; 'per-file-ignores'?: Record<string, string[]> };
};

/** Knip entries associated with the root and detected package workspaces. */
export type KnipToolFile = { ignore: string[]; workspaces: Record<string, { entry: string[] }> };

/** Stylelint rule settings read by shared framework defaults. */
export type StylelintToolFile = Required<Pick<Config, 'rules'>> & Pick<Config, 'overrides'>;
