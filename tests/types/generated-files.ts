import type { Config } from 'stylelint';

/** Ruff options for generation tests of levels and scoped settings. */
export type RuffConfigFile = {
    lint: { select: string[]; pylint: { 'max-statements': number }; 'per-file-ignores'?: Record<string, string[]> };
    format: { 'quote-style': string };
};

/** Knip entries for the root and each detected package workspace. */
export type KnipConfigFile = { ignore: string[]; workspaces: Record<string, { entry: string[] }> };

/** The rules and overrides of a generated Stylelint config file. */
export type StylelintConfigFile = Required<Pick<Config, 'rules'>> & Pick<Config, 'overrides'>;
