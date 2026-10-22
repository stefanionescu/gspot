const STATIC_SITE_FILES = {
    '.gitignore': 'node_modules\ndist\n',
    'package.json': `{
    "name": "example",
    "version": "1.0.0",
    "private": true,
    "packageManager": "bun@1.4.2",
    "description": "A test site.",
    "type": "module",
    "engines": {
        "node": ">=24.2.0"
    },
    "devDependencies": {
        "@types/node": "22.18.6"
    },
    "scripts": {
        "build": "bun build.js"
    }
}
`,
    'build.js': `// Copies the pages, the style sheet, the sitemap, and the assets into dist.
import { cp, rm, mkdir } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const name of ['index.html', 'about.html', 'site.css', 'sitemap.xml', 'logo.svg']) await cp(name, \`dist/\${name}\`);
`,
    'index.html': `<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <title>Test</title>
        <link rel="stylesheet" href="/site.css" />
    </head>
    <body>
        <h1 class="title">Test</h1>
        <a href="/about.html">About</a>
        <img src="/logo.svg" alt="The logo" />
    </body>
</html>
`,
    'about.html': `<!doctype html>
<html lang="en">
    <head>
        <title>About this site</title>
        <meta charset="utf-8" />
    </head>
    <body>
        <main>
            <h1>About</h1>
            <p>This page describes the sample site.</p>
            <nav><a href="/">Home</a></nav>
        </main>
    </body>
</html>
`,
    'site.css': `.title {
    color: #333;
}
`,
    'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://example.test/</loc></url>
    <url><loc>https://example.test/about.html</loc></url>
</urlset>
`,
    _headers: `/*
    X-Content-Type-Options: nosniff
    Referrer-Policy: strict-origin-when-cross-origin
    X-Frame-Options: DENY
`,
    'site.webmanifest': `{
    "name": "Test",
    "icons": [{ "src": "/logo.svg" }]
}
`,
    'logo.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>',
} as const;
export const SITE_SANDBOX = {
    configurations: ['site'],

    files: STATIC_SITE_FILES,
} as const;

/** Built-output checks run without installing tools. */
export const BUILT_PAGE_CASES = [
    {
        check: 'site/size',
        files: {},
        settings: `[[site.size_limit]]
paths = ["dist/**/*.html"]
kilobytes = 0
`,
        expected: { file: 'gspot.toml', rule: 'size', line: 1 },
        corrected: {
            files: {},
            settings: `[[site.size_limit]]
paths = ["dist/**/*.html"]
kilobytes = 10
`,
        },
    },
    {
        check: 'site/sitemap',
        files: {
            'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://example.test/</loc></url>
    <url><loc>https://example.test/about.html</loc></url>
    <url><loc>https://example.test/pricing.html</loc></url>
</urlset>
`,
        },
        expected: { file: 'dist/sitemap.xml', rule: 'missing-page', line: 1 },
    },
] as const;

/** Settings that select the site build checks at level all. */
export const SITE_SETTINGS = `level = "all"
configurations = ["site"]
[site]
build_command = ["bun", "build.js"]
`;
export const ALT_TEXT_PAGE = `<!doctype html>
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
