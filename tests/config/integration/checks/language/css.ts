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
