import type { Config } from 'stylelint';

export type RuffConfigFile = {
    lint: { select: string[]; pylint: { 'max-statements': number }; 'per-file-ignores'?: Record<string, string[]> };
    format: { 'quote-style': string };
};

export type KnipConfigFile = { ignore: string[]; workspaces: Record<string, { entry: string[] }> };

export type StylelintConfigFile = Required<Pick<Config, 'rules'>> & Pick<Config, 'overrides'>;

export type SemgrepRuleFile = { rules: { id: string; paths?: { include?: string[]; exclude?: string[] } }[] };
