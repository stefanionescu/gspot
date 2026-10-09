/** Built pages with one located accessibility finding and its fix. */
export const SITE_HTML_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Example</title></head>
<body>
<main>
<h1>Example</h1>
<img src="logo.svg">
</main>
</body>
</html>
`;
export const SITE_HTML_CORRECTED = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Example</title></head>
<body>
<main>
<h1>Example</h1>
<img src="logo.svg" alt="Example">
</main>
</body>
</html>
`;
/** Each scope copies its own authored page into its built output. */
export const SITE_HTML_BUILD = `import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
copyFileSync('page.html', 'dist/index.html');
`;
/** The root owns HTML; two sites own their builds and one whole-scope accessibility exception. */
export const SITE_HTML_SCOPES = `[agent_rules]
enabled = false
[[ignore]]
check = "site/html-validate"
rule = "wcag/h37"
paths = ["app/**"]
reason = "Application alternative text is supplied by the rendering environment."
[scope."app"]
configurations = ["site"]
[scope.app.site]
build_command = ["node", "build.mjs"]
[scope."other"]
configurations = ["site"]
[scope.other.site]
build_command = ["node", "build.mjs"]
`;
/** An exception applies to its selected site while the other site keeps the native rule. */
export const SITE_HTML_RULE_SCOPES = [
    ['app', 'off'],
    ['other', 'error'],
] as const;
/** Site-only scopes and sites below an HTML owner both keep native rule exceptions confined. */
export const SITE_HTML_REPOSITORIES = [
    { name: 'a root HTML configuration', configurations: ['html'], files: { 'index.html': SITE_HTML_CORRECTED } },
    { name: 'site-only child configurations', configurations: [], files: {} },
];
