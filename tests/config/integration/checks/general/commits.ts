export const COMMIT_MESSAGES = [
    { message: 'fix(Core): repair the parser', rule: undefined },
    { message: 'fix: repair the parser', rule: undefined },
    { message: 'style(Core): format source', rule: undefined },
    { message: 'revert(Core): restore source', rule: undefined },
    { message: 'feat(Core)!: drop the parser option', rule: undefined },
    { message: 'feat!: drop the parser option', rule: undefined },
    { message: 'fix(root): repair the parser', rule: 'scope-enum' },
    { message: 'fix(hooks): repair the parser', rule: 'scope-enum' },
    { message: 'fix(deps): repair the parser', rule: 'scope-enum' },
    { message: 'fix(core): repair the parser', rule: 'scope-enum' },
    { message: 'fix(Core): repair the parser.', rule: 'subject-full-stop' },
    { message: 'fix(Core): xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', rule: undefined },
    { message: 'fix(Core): xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', rule: 'header-max-length' },
] as const;

export const COMMITLINT_LEVEL_RESULTS = {
    basic: {
        code: 2,
        output: {
            error: 'arguments',
            message: 'commits/commitlint is off at level basic. Run gspot set level all to turn it on.',
        },
    },
    all: { code: 0, output: { checks: [{ check: 'commits/commitlint', status: 'passed', findings: [] }] } },
} as const;

export const UNTYPED_MESSAGE_RULES = ['type-empty', 'subject-empty', 'subject-full-stop'] as const;
