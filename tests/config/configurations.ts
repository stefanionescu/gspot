export const SEMGREP_ASSETS = [
    'configurations/language/example/tool-files/semgrep/first.yml',
    'configurations/language/example/tool-files/semgrep/second.yml',
    'configurations/language/example/tool-files/semgrep/not-a-pack.txt',
] as const;

export const CONFIGURATION_TABLE = `
[configuration]
title = "Local"
description = "A local configuration used by manifest loading."
`;

export const ALWAYS_SELECTED = [
    'commits',
    'dependencies',
    'docs',
    'duplication',
    'engineering',
    'files',
    'format',
    'gspot',
    'naming',
    'prose',
    'repository',
    'secrets',
    'security',
    'spelling',
    'structure',
] as const;

export const SEMGREP_TOOL_FILES = `
[[tool_file]]
target = ".gspot/config/other.yml"
pointer = { path = "other.yml" }

[[tool_file]]
target = ".gspot/config/semgrep/first.yml"
tool = "semgrep"
per_scope = true
when = { configuration = "security" }

[[tool_file]]
target = ".gspot/config/semgrep/second.yml"
tool = "semgrep"
per_scope = true
when = { configuration = "security" }
`;

/** Authored rule-name lists whose metadata must follow their package pins. */
export const RULE_NAME_FILES = [
    'configurations/language/javascript/eslint-rule-names.json',
    'configurations/language/javascript/eslint-runtime-names.json',
    'configurations/language/css/stylelint-rule-names.json',
] as const;
