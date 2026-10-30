import { BASE_INSTALLED_FILES } from '#tests/config/integration/checks/samples.ts';

export const STYLESHEETS = {
    'build/site.css': `a {
    color: #ff0000;
    width: 1.5px;
    -webkit-text-size-adjust: 100%;
}
`,
    'app/site.css': `#example {
    color: #f00;
    width: 1.5px;
    -webkit-backdrop-filter: blur(2px);
}
`,
} as const;

export const ROOT_STYLELINT_RULES = `[tools.stylelint.rules]
color-hex-length = "short"
`;

export const APP_STYLELINT_SCOPE = `[[scope]]
path = "app"

configurations = []
[scope.tools.stylelint.rules]
color-hex-length = "long"
`;

export const ALL_LEVEL_STYLELINT_TABLES = `${ROOT_STYLELINT_RULES}number-max-precision = 0
${APP_STYLELINT_SCOPE}`;

export const CORRECTED_STYLESHEETS = {
    'build/site.css': `a {
    color: #f00;
    width: 1px;
    text-size-adjust: 100%;
}
`,
    'app/site.css': `#example {
    color: #ff0000;
    width: 1px;
    backdrop-filter: blur(2px);
}
`,
} as const;

export const TAILWIND_FILES = {
    'package.json': '{"private":true,"dependencies":{"next":"16.3.5"}}\n',
    'build/site.css': `@tailwind utilities;

a {
    color: theme("colors.brand");
}
`,
    'app/package.json': '{"private":true,"devDependencies":{"tailwindcss":"4.1.13"}}\n',
    'app/site.css': `@tailwind utilities;

a {
    color: theme("colors.brand");
}
`,
    'other/package.json': '{"private":true}\n',
    'other/site.css': `@tailwind utilities;

a {
    color: theme("colors.brand");
}
`,
} as const;

export const STYLELINT_COMMAND = ['check', '--only', 'css/stylelint', '--json'] as const;

export const AUTOPLAY_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Example</title></head>
<body>
<main>
<h1>Example</h1>
<audio src="sound.ogg" autoplay controls></audio>
<video src="movie.mp4" autoplay controls></video>
</main>
</body>
</html>
`;

export const CONTROLLED_PLAYBACK_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Example</title></head>
<body>
<main>
<h1>Example</h1>
<audio src="sound.ogg" controls></audio>
<video src="movie.mp4" controls></video>
</main>
</body>
</html>
`;

export const AUTOPLAY_CHECKS = [
    {
        check: 'html/html-validate',
        scope: '',
        arguments: ['check', 'index.html', '--json', '--only', 'html/html-validate'],
        source: 'index.html',
        findings: [
            { file: 'index.html', line: 7, column: 24, rule: 'no-autoplay' },
            { file: 'index.html', line: 8, column: 24, rule: 'no-autoplay' },
        ],
    },
    {
        check: 'site/html-validate',
        scope: 'app',
        arguments: ['check', 'app', '--json', '--only', 'site/html-validate'],
        source: 'app/page.html',
        findings: [
            { file: 'app/dist/index.html', line: 7, rule: 'no-autoplay' },
            { file: 'app/dist/index.html', line: 8, rule: 'no-autoplay' },
        ],
    },
] as const;

export const HTML_SANDBOX = {
    configurations: ['html', 'site'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;

export const MARKDOWN_FILES = {
    'root.md': `# Root

## Notes

Root label.

![](diagram.png)
`,
    'app/guide.md': `# Guide

## Notes

Nested label.
`,
    'title.md': 'A document without a title.\n',
    'long.md': `# Long

Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter.

<span>Inline HTML stays permitted.</span>

| Name | Value |
| ---- | ----- |
| A    | B     |
`,
} as const;

export const MDX_FILES = {
    'policy.mdx': `import { Notice } from './notice';
import Updated from './updated';

export const metadata = {
    description: 'How the shop keeps your data.',
};

# Privacy

The shop keeps your order history.
`,
    'untitled.mdx': `import { Notice } from './notice';

The page has no heading.
`,
} as const;

export const MARKDOWNLINT_TABLES = `[format]
indent_width = 6
[tools.markdownlint.rules]
MD044 = { names = ["Root label"], code_blocks = false }
MD060 = { style = "aligned" }
[[scope]]
path = "app"

configurations = []
[scope.tools.markdownlint.rules]
MD044 = { names = ["Nested label"] }
`;

export const TITLED_DOCUMENT = '# Title\n\nA document with a title.\n';

export const REQUEST_FLOW_IMAGE = '![Request flow]';

const SQL_CLEAN = `-- The accounts of the application.
CREATE TABLE user_accounts (
    id UUID PRIMARY KEY,
    display_name TEXT NOT NULL
);
`;

export const SQL_SANDBOX = {
    configurations: ['sql'],
    files: {
        'db/accounts.sql': SQL_CLEAN,
        'db/report.sql':
            "\\set team 'core'\nSELECT id FROM user_accounts WHERE display_name = :'team' AND id = :account_id;\n",
    },
} as const;

export const SQL_CASES = [
    {
        check: 'sql/sqlfluff',
        files: { 'db/lower.sql': 'SELECT id from user_accounts;\n' },
        corrected: { files: { 'db/lower.sql': 'SELECT id FROM user_accounts;\n' } },
        expected: { file: 'db/lower.sql', rule: 'CP01', line: 1 },
    },
] as const;

export const SQL_FUNCTION_SOURCE = `CREATE FUNCTION get_user_name() RETURNS TEXT AS $$ SELECT 'Alex'; $$ LANGUAGE sql;
SELECT get_user_name();
`;

export const SQLFLUFF_DIALECT_SETTINGS = {
    tables: `[tools.sqlfluff]
dialect = "postgres"
[[scope]]
path = "warehouse"
[scope.tools.sqlfluff]
dialect = "duckdb"
[[scope]]
path = "warehouse/child"
`,
} as const;
