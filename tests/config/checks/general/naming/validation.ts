export const NAME_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] as const;

export const NAMING_LIMIT_CASES = [
    { language: 'typescript', category: 'variables', characters: 21, words: 2 },
    { language: 'javascript', category: 'variables', characters: 22, words: 2 },
    { language: 'python', category: 'variables', characters: 23, words: 3 },
    { language: 'swift', category: 'functions', characters: 24, words: 3 },
    { language: 'bash', category: 'variables', characters: 25, words: 3 },
    { language: 'sql', category: 'functions', characters: 26, words: 3 },
] as const;

export const HANDLE_ROUTE_IDENTIFIER = {
    file: 'src/routes/auth.ts',
    line: 1,
    column: 1,
    language: 'typescript',
    category: 'functions',
    label: 'function',
    name: 'handleLogin',
} as const;

export const HOOK_PREFIX_TABLES = `[naming]
banned_words = ["handle", "use"]
[[naming.override]]
paths = ["src/hooks/**"]
categories = ["functions"]
ignored_prefix = "^use(?=[A-Z])"
reason = "A hook starts with use."
`;

export const ALLOWED_NAME_TABLES = `[[naming.override]]
paths = ["**"]
allowed_names = ["requestAnimationFrame"]
reason = "The browser API names it."
[[naming.override]]
paths = ["api/route.ts"]
allowed_names = ["Content-Type"]
reason = "The HTTP header names it."
`;

export const HANDLE_PREFIX_TABLES = `[naming]
banned_words = ["handle"]
[[naming.override]]
paths = ["src/**"]
languages = ["typescript", "javascript"]
categories = ["functions", "methods"]
ignored_prefix = "^handle(?=[A-Z])"
reason = "Event handlers start with handle."
`;

export const OVERLONG_NAME_FINDINGS = [
    { rule: 'digits', message: `typescript functions "helperValue2UserUserWithMoreWordsHere": a digit is not a word.` },
    {
        rule: 'length',
        message: `typescript functions "helperValue2UserUserWithMoreWordsHere": 37 characters is over the limit of 35.`,
    },
    {
        rule: 'words',
        message: `typescript functions "helperValue2UserUserWithMoreWordsHere": 8 words is over the limit of 4.`,
    },
    {
        rule: 'duplicate-words',
        message: `typescript functions "helperValue2UserUserWithMoreWordsHere": "user" repeats.`,
    },
    {
        rule: 'banned-word',
        message: `typescript functions "helperValue2UserUserWithMoreWordsHere": "helper" is banned (roles list).`,
    },
] as const;

export const LINTER_LIMIT_CASES = [
    {
        language: 'swift',
        category: 'types',
        expected: [],
        wordy: [
            {
                rule: 'words',
                message: 'types "one_two_three_four_five_six_seven_eight": 8 words is over the limit of 5.',
            },
        ],
    },
    {
        language: 'swift',
        category: 'functions',
        expected: [
            {
                rule: 'case',
                message: 'functions "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": expected upper-snake case.',
            },
            {
                rule: 'length',
                message:
                    'functions "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": 41 characters is over the limit of 40.',
            },
        ],
        wordy: [
            {
                rule: 'case',
                message: 'functions "one_two_three_four_five_six_seven_eight": expected upper-snake case.',
            },
            {
                rule: 'words',
                message: 'functions "one_two_three_four_five_six_seven_eight": 8 words is over the limit of 5.',
            },
        ],
    },
    {
        language: 'python',
        category: 'classes',
        expected: [
            {
                rule: 'length',
                message: 'classes "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": 41 characters is over the limit of 35.',
            },
        ],
        wordy: [
            {
                rule: 'length',
                message: 'classes "one_two_three_four_five_six_seven_eight": 39 characters is over the limit of 35.',
            },
            {
                rule: 'words',
                message: 'classes "one_two_three_four_five_six_seven_eight": 8 words is over the limit of 4.',
            },
        ],
    },
] as const;
