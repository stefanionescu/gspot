export const NAME_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] as const;
export const NAMING_LANGUAGES = ['typescript', 'javascript', 'python', 'swift', 'bash', 'sql'] as const;
export const UPPER_SNAKE_OVERRIDE = `[[naming.override]]
paths = ["source"]
cases = ["upper-snake"]
reason = "The authored interface selects this case."
`;

/** Banned words of gspot.toml that no shipped group holds: a word, a two-word run, and a hyphenated word. */
export const BANNED_WORD_TABLES = '[naming]\nbanned_words = ["widget", "paper trail", "cross-cutting"]\n';

/** A route function whose handle prefix an override strips. */
export const HANDLE_ROUTE_IDENTIFIER = {
    file: 'src/routes/auth.ts',
    line: 1,
    column: 1,
    language: 'typescript',
    category: 'functions',
    label: 'function',
    name: 'handleLogin',
} as const;

/** Repository banned words, and an override that strips use from hook functions. */
export const HOOK_PREFIX_TABLES = `[naming]
banned_words = ["handle", "use"]
[[naming.override]]
paths = ["src/hooks/**"]
categories = ["functions"]
ignored_prefix = "^use(?=[A-Z])"
reason = "A hook starts with use."
`;

/** An override that allows digits in acceptance tests. */
export const ACCEPTANCE_DIGIT_TABLES = `[[naming.override]]
paths = ["tests/acceptance/**"]
allow_digits = true
reason = "Acceptance fixtures number their steps."
`;

/** An allowed name for every file, and one for a single file. */
export const ALLOWED_NAME_TABLES = `[[naming.override]]
paths = ["**"]
allowed_names = ["requestAnimationFrame"]
reason = "The browser API names it."
[[naming.override]]
paths = ["api/route.ts"]
allowed_names = ["Content-Type"]
reason = "The HTTP header names it."
`;

/** A banned word, and an override that strips it as a prefix of functions and methods in src. */
export const HANDLE_PREFIX_TABLES = `[naming]
banned_words = ["handle"]
[[naming.override]]
paths = ["src/**"]
languages = ["typescript", "javascript"]
categories = ["functions", "methods"]
ignored_prefix = "^handle(?=[A-Z])"
reason = "Event handlers start with handle."
`;

/** A name over every limit: a digit, 37 characters, 8 words, a repeated word, and a banned word. */
export const OVERLONG_NAME = 'helperValue2UserUserWithMoreWordsHere';

/** The five findings of the overlong name, in the order the check reports them. */
export const OVERLONG_NAME_FINDINGS = [
    { rule: 'digits', message: `typescript functions "${OVERLONG_NAME}": a digit is not a word.` },
    { rule: 'length', message: `typescript functions "${OVERLONG_NAME}": 37 characters is over the limit of 35.` },
    { rule: 'words', message: `typescript functions "${OVERLONG_NAME}": 8 words is over the limit of 4.` },
    { rule: 'duplicate-words', message: `typescript functions "${OVERLONG_NAME}": "user" repeats.` },
    { rule: 'banned-word', message: `typescript functions "${OVERLONG_NAME}": "helper" is banned (roles group).` },
] as const;
/** Expected naming findings where the language linter owns some of the naming rules. */
export const LINTER_LIMIT_CASES = [
    { language: 'swift', category: 'types', expected: [] },
    { language: 'swift', category: 'functions', expected: ['case', 'length'] },
    { language: 'python', category: 'classes', expected: ['length'] },
    { language: 'python', category: 'exceptions', expected: ['length'] },
] as const;
