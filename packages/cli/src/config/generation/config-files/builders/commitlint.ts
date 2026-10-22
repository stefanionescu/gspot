export const COMMITLINT_ERROR_SEVERITY = 2;

const COMMIT_LINE_LENGTH = 72;

export const COMMITLINT_RULES = {
    'type-case': [COMMITLINT_ERROR_SEVERITY, 'always', 'lower-case'],
    'type-empty': [COMMITLINT_ERROR_SEVERITY, 'never'],
    'scope-case': [COMMITLINT_ERROR_SEVERITY, 'always', 'kebab-case'],
    'subject-empty': [COMMITLINT_ERROR_SEVERITY, 'never'],
    'subject-full-stop': [COMMITLINT_ERROR_SEVERITY, 'never', '.'],
    'subject-case': [COMMITLINT_ERROR_SEVERITY, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [COMMITLINT_ERROR_SEVERITY, 'always', COMMIT_LINE_LENGTH],
    'body-leading-blank': [COMMITLINT_ERROR_SEVERITY, 'always'],
    'body-max-line-length': [COMMITLINT_ERROR_SEVERITY, 'always', COMMIT_LINE_LENGTH],
    'footer-leading-blank': [COMMITLINT_ERROR_SEVERITY, 'always'],
} as const;
