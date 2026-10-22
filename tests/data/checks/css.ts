/** Your own package.json, whose Stylelint field hides the generated pointer. */
export const STYLELINT_PACKAGE_JSON = `{
  "name": "native-project",
  "private": true,
  "type": "module",
  "stylelint": {"rules":{"property-no-unknown":null}}
}
`;

/** Authored files that must stay unchanged when gspot changes the Stylelint tool file. */
export const STYLELINT_FILES = {
    'package.json': STYLELINT_PACKAGE_JSON,
    'source.css': 'a { opacity: 1; }\n',
    'app/package.json': STYLELINT_PACKAGE_JSON,
    'app/source.css': 'a { opacity: 1; }\n',
    'app/child/package.json': STYLELINT_PACKAGE_JSON,
    'other/package.json': STYLELINT_PACKAGE_JSON,
    'plain/package.json': '{"private":true}\n',
} as const;

/** A build folder name does not mark a stylesheet as build output; Stylelint checks both. */
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

export const STYLELINT_TABLES = `[tools.stylelint.rules]\ncolor-hex-length = "short"\n[[scope]]\npath = "app"\n\nconfigurations = []\n[scope.tools.stylelint.rules]\ncolor-hex-length = "long"\n`;

export const ALL_LEVEL_STYLELINT_TABLES = `[tools.stylelint.rules]\ncolor-hex-length = "short"\nnumber-max-precision = 0\n[[scope]]\npath = "app"\n\nconfigurations = []\n[scope.tools.stylelint.rules]\ncolor-hex-length = "long"\n`;

/** Standard properties, whole pixels, and the hex length that each scope asks for fix every finding at both levels. */
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

/** Tailwind syntax applies only inside the package that declares Tailwind. */
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

export const TAILWIND_TABLES = `[[scope]]\npath = "app"\n\nconfigurations = ["css"]\n[[scope]]\npath = "other"\n\nconfigurations = ["css"]\n`;

/** A property Stylelint rejects at both levels. */
export const INVALID_CSS = `a {
    invalid-property: 1;
}
`;

/** The command that runs only Stylelint and prints the JSON report. */
export const STYLELINT_COMMAND = ['check', '--only', 'css/stylelint', '--json'] as const;
