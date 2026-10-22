/** Each Ruff suppression, whether Ruff honors it for F401, and whether gspot records it as a suppression on line 1. */
export const RUFF_SUPPRESSIONS = [
    { source: 'import os # noqa: F401\n', suppressed: true, directive: true },
    { source: 'import os # NOQA: F401\n', suppressed: true, directive: true },
    { source: 'import os # NoQa: F401\n', suppressed: true, directive: true },
    { source: 'import os # Example noqa: F401\n', suppressed: false, directive: false },
    { source: 'import os # Example # noqa: F401\n', suppressed: true, directive: true },
    { source: 'import os # noqa-unknown: F401\n', suppressed: false, directive: false },
    { source: 'import os # noqa: F401 # reason: External import.\n', suppressed: true, directive: true },
    { source: '# ruff: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# ruff: NoQa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# flake8: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# Example # ruff: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: 'import os # ruff: noqa: F401\n', suppressed: false, directive: false },
    { source: 'import os # flake8: noqa: F401\n', suppressed: false, directive: false },
    { source: '# RUFF: NOQA: F401\nimport os\n', suppressed: false, directive: false },
    { source: '# noqa: F401\nimport os\n', suppressed: false, directive: true },
    { source: 'import os # noqa: F821\n', suppressed: false, directive: true },
] as const;

/** The check refuses Vale suppressions and keeps code examples and ordinary comments. */
export const VALE_SUPPRESSIONS = [
    { source: '<!-- vale off -->', suppressed: true, directive: true },
    { source: '<!-- vale Example.Concrete = NO -->', suppressed: true, directive: true },
    { source: '<!-- vale Example.Concrete = YES -->', suppressed: false, directive: true },
    { source: '<!-- vale on -->', suppressed: false, directive: true },
    { source: '<!-- Example vale off -->', suppressed: false, directive: false },
    { source: '`<!-- vale off -->`', suppressed: false, directive: false },
    { source: '```markdown\n<!-- vale off -->\n```', suppressed: false, directive: false },
] as const;

/** The vale.ini of the suppression sample. */
export const VALE_SUPPRESSION_SETTINGS = `StylesPath = styles
[formats]
mdx = md
[*]
BasedOnStyles = Example
`;
