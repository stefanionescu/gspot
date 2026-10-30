import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import type { FenceParser } from '#cli/types/checks/language/language.ts';

export const SURROUNDING_QUOTES = /^["']|["']$/gu;

export const EXECUTABLE_SCRIPT_TYPES: ReadonlySet<string> = new Set([
    '',
    'module',
    'application/ecmascript',
    'application/javascript',
    'application/x-ecmascript',
    'application/x-javascript',
    'text/ecmascript',
    'text/javascript',
    'text/javascript1.0',
    'text/javascript1.1',
    'text/javascript1.2',
    'text/javascript1.3',
    'text/javascript1.4',
    'text/javascript1.5',
    'text/jscript',
    'text/livescript',
    'text/x-ecmascript',
    'text/x-javascript',
]);

export const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'src', 'action', 'formaction', 'data', 'background']);

export const DOCUMENT_URL_ATTRIBUTES: ReadonlyMap<string, readonly string[]> = new Map([
    ['a', ['href', 'xlink:href']],
    ['area', ['href']],
    ['iframe', ['src']],
    ['frame', ['src']],
    ['object', ['data']],
    ['embed', ['src']],
]);

export const ACTIVE_DOCUMENT_TYPES = new Set(['text/html', 'application/xhtml+xml', 'image/svg+xml']);

export const EVENT_ATTRIBUTE = /^on[a-z]+$/u;

export const SCRIPT_SCHEMES = new Set(['javascript:', 'vbscript:']);

export const RELATIVE_URL_BASE = 'https://example.invalid';

export const INLINE_SCRIPT_MESSAGE = 'Move executable inline script to a script file.';

export const HTML_RULES = {
    scriptLink: 'script-link',
    inlineScript: 'inline-script',
    handlerAttribute: 'handler-attribute',
} as const;

export const JAVASCRIPT_TSC_COMMAND = ['tsc', '-p'] as const;

export const JSCONFIG_TSBUILDINFO = 'jsconfig.check.tsbuildinfo';

export const GRAMMAR_FENCE_PARSERS = ['bash', 'typescript', 'tsx', 'javascript', 'python'] as const;

export const ELLIPSIS_LINE = /^[\s#/]*\.\.\.\s*$/u;

export const ELLIPSIS_ARGUMENTS = '(...)';

export const ANGLE_PLACEHOLDER = /<[A-Za-z][A-Za-z0-9_-]*>/gu;

export const FENCE_PARSERS: ReadonlyMap<string, FenceParser> = new Map([
    ['json', 'json'],
    ['jsonc', 'jsonc'],
    ['toml', 'toml'],
    ['yaml', 'yaml'],
    ['yml', 'yaml'],
    ['bash', 'bash'],
    ['sh', 'bash'],
    ['shell', 'bash'],
    ['ts', 'typescript'],
    ['typescript', 'typescript'],
    ['tsx', 'tsx'],
    ['js', 'javascript'],
    ['jsx', 'javascript'],
    ['javascript', 'javascript'],
    ['mjs', 'javascript'],
    ['cjs', 'javascript'],
    ['python', 'python'],
    ['py', 'python'],
]);

export const JSON_FENCE_OPTIONS = { disallowComments: true, allowTrailingComma: false } as const;

export const OMITTED_BASH_LINE = ':';

export const EMPTY_ARGUMENTS = '()';

export const PLACEHOLDER_VALUE = 'PLACEHOLDER';

export const CAMEL_CASE_BOUNDARY = /(?<first>[a-z])(?<next>[A-Z])/gu;

export const CAMEL_CASE_REPLACEMENT = '$<first> $<next>';

export const SYNTAX_ERROR_MESSAGE = 'Syntax error.';

export const DEPTRY_FIRST_PARTY_FLAG = '--known-first-party';

export const DEPTRY_COMMAND = ['deptry', '.', '--no-ansi'] as const;

export const DEPTRY_EXCLUDE_FLAG = '--extend-exclude';

export const INSTALL_FILE_SUFFIXES = ['.sh', '.bash', '.yml', '.yaml', '.toml', 'Dockerfile'] as const;

export const PIP_INSTALL = /\bpip3? install\b/u;

export const NON_WORD_RUN = /[^a-z\d]+/gu;

export const PLACEHOLDERS = new Set(['todo', 'docstring', 'tbd', 'fixme', 'description', 'summary']);

export const GOOGLE_DOCSTRING = /^[ \t]*(?:Args|Arguments|Keyword Args):[ \t]*$/mu;

export const NUMPY_DOCSTRING = /^[ \t]*Parameters[ \t]*\r?\n[ \t]*-{3,}[ \t]*$/mu;

export const PYDOCLINT_TYPE_OPTIONS = [
    'arg-type-hints-in-docstring',
    'check-return-types',
    'check-yield-types',
] as const;

export const PYDOCLINT_ALL_LEVEL_OPTIONS = ['skip-checking-short-docstrings'] as const;

export const PYDOCLINT_COMMAND = ['pydoclint', '--allow-init-docstring', 'true', '--quiet', '{files}'] as const;

export const PYDOCLINT_STYLE_FLAG = '--style';

export const PYDOCLINT_DEFAULT_STYLE = 'numpy';

export const DOCSTRING_STYLES = ['google', 'numpy', 'sphinx'] as const;

export const VULTURE_FINDING =
    /^(?<file>.+?):(?<line>\d+): (?:unused (?<kind>attribute|class|function|method|property) '(?<name>[^']+)'|unreachable code after '(?<statement>[^']+)') \(\d+% confidence/u;

export const VULTURE_COMMAND = ['vulture'] as const;

export const VULTURE_DEAD_CODE = 3;

export const NO_LOCKFILE_NOTE = 'This check needs uv.lock, poetry.lock, or pdm.lock in this scope.';

export const REQUIREMENTS_FILE_MESSAGE =
    'A hand-kept requirements file is a second owner of the dependencies. Export it from the lockfile and declare it generated, or delete it.';

export const PIP_INSTALL_MESSAGE = 'Add the package to pyproject.toml and install it from the lockfile.';

export const NO_PYPROJECT_NOTE = 'This scope has no pyproject.toml for deptry to read.';

export const PYTHON_RULES = {
    functionLines: 'function-lines',
    requirementsFile: 'requirements-file',
    pipInstall: 'pip-install',
    placeholderDocstring: 'placeholder-docstring',
    unreachableCode: 'unreachable-code',
} as const;

export const DEPTRY_GSPOT_EXCLUDE = String.raw`(^|.*[/\\])${RegExp.escape(GSPOT_FOLDER)}([/\\]|$)`;

export const REQUIREMENTS_FOLDER_FILE = /(?:^|\/)requirements\/[^/]+\.txt$/u;

export const TSCONFIG_NAME = /^tsconfig\.(?:.+\.)?json$/u;

export const MISSING_TSCONFIG_RULE = 'missing';

export const MISSING_TSCONFIG_MESSAGE =
    'Add a tsconfig.json to this scope. ESLint and tsc read the TypeScript files through it.';

export const OPTION_HELP = 'Turn this compiler option on in this tsconfig.';

export const STRICT_FAMILY_OPTIONS = [
    'alwaysStrict',
    'noImplicitAny',
    'noImplicitThis',
    'strictBindCallApply',
    'strictBuiltinIteratorReturn',
    'strictFunctionTypes',
    'strictNullChecks',
    'strictPropertyInitialization',
    'useUnknownInCatchVariables',
] as const;
