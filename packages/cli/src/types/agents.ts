// The types of agents in this package.

/** One thing the rule lint found: the file relative to rules/, the one-based line, and what is wrong. */
export type RuleFinding = { file: string; line: number; message: string };
/** A rule file by its path relative to rules/. */
export type RuleText = { path: string; text: string };
/** The rule lint's result. */
export type RulesLintReport = { findings: RuleFinding[]; files: number };
export type RuleFile = { source: string; target: string; layer: string; configuration: string; title: string };
/** The front matter of a rule file. */
export type FrontMatter = { layer: string; configuration: string; title: string; fields: Record<string, string> };
