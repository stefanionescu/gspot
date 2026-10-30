import { JSON_INDENT } from '#cli/config/text.ts';
import { PACKAGE_JSON_PATTERN } from '#cli/config/generation/configurations/language/javascript/eslint/blocks/base.ts';

export const ESLINT_FUNCTIONS_FILE = 'functions.mjs';

export const GLOBALS_IMPORT = ['globals', 'globals'] as const;

export const CONFIGURATION_BLOCKS_SUFFIX = 'Blocks';

export const NAME_HYPHEN = /-(?<letter>[a-z0-9])/gu;

export const ESLINT_BASE_LABEL = 'javascript';

export const PRESETS_AFTER_CONFIGURATIONS = [
    {
        importName: 'packageJson',
        package: 'eslint-plugin-package-json',
        path: 'configs.recommended',
        files: [PACKAGE_JSON_PATTERN],
    },
    { importName: 'prettierConfig', package: 'eslint-config-prettier', path: '' },
] as const;

export const PRESETS_BEFORE_CONFIGURATIONS = [
    { importName: 'eslint', package: '@eslint/js', path: 'configs.recommended' },
    { importName: 'sonarjs', package: 'eslint-plugin-sonarjs', path: 'configs.recommended' },
    { importName: 'unicorn', package: 'eslint-plugin-unicorn', path: 'configs.recommended' },
] as const;

export const ESLINT_SETTINGS_TABLE = 'tools.eslint';

export const ESLINT_CHECK = 'javascript/eslint';

export const ESLINT_INDENT = ' '.repeat(JSON_INDENT);

export const COMPONENT_CONFIGURATIONS = ['vue', 'svelte'] as const;

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
        selector:
            ':matches(TSAsExpression[expression.type="TSAsExpression"], TSTypeAssertion[expression.type="TSTypeAssertion"])',
        message: 'Do not assert twice. Narrow the value, fix its type, or check it at run time.',
    },
    {
        selector: ':matches(TSAsExpression, TSTypeAssertion) > TSAnyKeyword',
        message: 'Do not assert to any. Give the value a real type, or check it at run time.',
    },
    {
        selector: ':matches(TSAsExpression, TSTypeAssertion) > TSNeverKeyword',
        message: 'Do not assert to never to silence the type system.',
    },
    {
        selector: String.raw`LogicalExpression[operator=/^(\|\||\?\?)$/][right.type="ObjectExpression"][right.properties.length=0]`,
        message: 'An empty-object fallback hides a missing value. Handle the missing case.',
    },
    {
        selector:
            'NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type="ObjectExpression"]) > :matches(Literal.arguments:first-child[value=/^[a-z]/], TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/])',
        message: 'Start an error message with a capital letter.',
    },
    {
        selector:
            'CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name="log"][callee.object.name!="console"]) > TemplateLiteral.arguments:first-child[expressions.length>0]',
        message: 'Log a stable message and pass the values as fields.',
    },
] as const;

export const ESLINT_FUNCTIONS = [
    'buildBlock',
    'readPreset',
    'mergePreset',
    'mergePresetRules',
    'spreadPreset',
    'mergeRuleOptions',
    'setRuleOptions',
    'setLevelRules',
    'addPlugins',
    'setRootFolder',
    'setImportLookup',
    'setBoundaryLookup',
    'setRuntime',
    'setComponentParser',
    'setScriptParser',
    'setJestGlobals',
    'buildRuntimeMatcher',
    'stripRuntimeGlobals',
    'buildComponentMatcher',
    'importAstroPlugin',
    'importSvelteParser',
] as const;

export const IMPORT_NAME_PUNCTUATION = /[{}\s]/gu;

export const ESLINT_PLUGIN_IMPORTERS = new Map([
    ['eslint-plugin-astro', 'importAstroPlugin'],
    ['svelte-eslint-parser', 'importSvelteParser'],
]);
