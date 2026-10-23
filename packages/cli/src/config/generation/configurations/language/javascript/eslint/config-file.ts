import { JSON_INDENT } from '#cli/config/text.ts';

/** The shipped module beside the main ESLint config file that holds the functions every ESLint config file calls. */
export const ESLINT_FUNCTIONS_FILE = 'functions.mjs';

/** The globals package, which the runtime blocks read. */
export const GLOBALS_IMPORT = ['globals', 'globals'] as const;

/** The path join of Node, which the import resolver block reads for each TypeScript project. */
export const PATH_JOIN_IMPORT = ['{ join }', 'node:path'] as const;

/** The end of the name under which the main ESLint config file imports the blocks of one configuration. */
export const CONFIGURATION_BLOCKS_SUFFIX = 'Blocks';

/** A hyphen and the letter after it in a configuration name, such as `-d` in `react-dom`. */
export const NAME_HYPHEN = /-(?<letter>[a-z0-9])/gu;

/** The source label of shared ESLint blocks. */
export const ESLINT_BASE_LABEL = 'javascript';

/** The plugin prefix of a rule name, such as `n` in `n/no-process-exit`; a core rule has none. */
export const RULE_PLUGIN_PREFIX = /^(?<prefix>.+)\/[^/]+$/u;

export const PACKAGE_JSON_PATTERN = '**/package.json';

export const PRESETS_AFTER_CONFIGURATIONS = [
    ['packageJson', 'packageJson'],
    ['prettier', 'prettierConfig'],
] as const;

export const PRESETS_BEFORE_CONFIGURATIONS = [
    ['eslint', 'eslint'],
    ['sonar', 'sonarjs'],
    ['unicorn', 'unicorn'],
] as const;

export const REACT_NATIVE_CONFIGURATION = 'react-native';

export const ESLINT_SETTINGS_TABLE = 'tools.eslint';
// The check that runs ESLint, whose ignores with a rule become blocks of the generated config file.

export const ESLINT_CHECK = 'javascript/eslint';

/** The indent of each generated ESLint block. */
export const ESLINT_INDENT = ' '.repeat(JSON_INDENT);

export const IMPORT_BOUNDARIES_RULE = 'gspot/import-boundaries';

export const COMPONENT_CONFIGURATIONS = ['vue', 'svelte'] as const;

/** The name of the runtime list that the main ESLint config file declares when a block matches files by runtime. */
export const RUNTIME_DECLARATIONS = 'runtimeDeclarations';

export const CODE_LANGUAGES = ['javascript', 'typescript'] as const;

export const BASE_SELECTORS = [
    {
        selector: ':matches(Program, BlockStatement, StaticBlock) > BlockStatement',
        message: 'A block that stands alone hides a step. Name the step as a function, or remove the braces.',
    },
    {
        selector: 'TSEnumDeclaration',
        message: 'Use a literal union or an as-const object instead of an enum.',
    },
    {
        selector: 'TSAsExpression[expression.type="TSAsExpression"]',
        message: 'Do not assert twice. Narrow the value, fix its type, or check it at run time.',
    },
    {
        selector: 'TSTypeAssertion[expression.type="TSTypeAssertion"]',
        message: 'Do not assert twice. Narrow the value, fix its type, or check it at run time.',
    },
    {
        selector: 'TSAsExpression > TSAnyKeyword',
        message: 'Do not assert to any. Give the value a real type, or check it at run time.',
    },
    {
        selector: 'TSTypeAssertion > TSAnyKeyword',
        message: 'Do not assert to any. Give the value a real type, or check it at run time.',
    },
    {
        selector: 'TSAsExpression > TSNeverKeyword',
        message: 'Do not assert to never to silence the type system.',
    },
    {
        selector: 'TSTypeAssertion > TSNeverKeyword',
        message: 'Do not assert to never to silence the type system.',
    },
    {
        selector: 'LogicalExpression[operator="||"][right.type="ObjectExpression"][right.properties.length=0]',
        message: 'An empty-object fallback hides a missing value. Handle the missing case.',
    },
    {
        selector: 'LogicalExpression[operator="??"][right.type="ObjectExpression"][right.properties.length=0]',
        message: 'An empty-object fallback hides a missing value. Handle the missing case.',
    },
    // Check a first message argument, alone or before options; keep error classes that take a code first.
    {
        selector:
            'NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type="ObjectExpression"]) > Literal.arguments:first-child[value=/^[a-z]/]',
        message: 'Start an error message with a capital letter.',
    },
    {
        selector:
            'NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type="ObjectExpression"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]',
        message: 'Start an error message with a capital letter.',
    },
    // A logger's log method takes fields too; console.log prints output for a person to read.
    {
        selector:
            'CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name="log"][callee.object.name!="console"]) > TemplateLiteral.arguments:first-child[expressions.length>0]',
        message: 'Log a stable message and pass the values as fields.',
    },
] as const;
