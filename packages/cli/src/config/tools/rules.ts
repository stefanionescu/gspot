export const ESLINT_BUILTIN_RULES = 'eslint/use-at-your-own-risk';
export const ESLINT_MANIFEST_TOOL = 'eslint';
export const INSTALL_FOR_RULES_MESSAGE =
    'gspot explain reads lint rules from the tools that gspot install puts in .gspot/node_modules. Run gspot install.';
export const MARKDOWNLINT_RULE_DESCRIPTION = /^MD\d+\/[^:]+ : (.+) : (https:\/\/\S+)$/u;
export const MARKDOWNLINT_RULE_SCHEMA = '../schema/markdownlint-config-schema.json';
export const RUFF_SUMMARY_FIELD = /\{(\w+)?(?::[^{}]*)?\}/gu;
export const SHELLCHECK_RULE_IDENTIFIER = /^SC\d{4}$/u;
export const STYLELINT_MANIFEST_TOOL = 'stylelint';
export const SWIFTLINT_RULE_ARGUMENTS = ['rules', '--default-config', '--config'] as const;
export const SWIFTLINT_RULE_IDENTIFIER = /^[a-z][a-z0-9_]*$/u;
export const SWIFTLINT_UNKNOWN_RULE = 'No rule with identifier';
// ESLint cannot name the gspot setting that declares the global names of another runtime.
export const UNDEFINED_NAME_FIX =
    'Declare or import the name. For a global name of another runtime, such as `document` in a browser script, write a [[tools.eslint.override]] record in gspot.toml with the paths of the files and runtime = "browser", then run gspot install.';
