// The test site build script whose output the site checks read.
const BUILD =
    "// Copies the pages, the stylesheet, the sitemap and the assets into dist.\nimport { cpSync, rmSync, mkdirSync } from 'node:fs';\n\nrmSync('dist', { recursive: true, force: true });\nmkdirSync('dist', { recursive: true });\nfor (const name of ['index.html', 'about.html', 'site.css', 'sitemap.xml']) cpSync(name, `dist/${name}`);\ncpSync('assets', 'dist/assets', { recursive: true });\n";

const STATIC_SITE_HEADERS =
    '/*\n    X-Content-Type-Options: nosniff\n    Referrer-Policy: strict-origin-when-cross-origin\n    X-Frame-Options: DENY\n';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>';

const HOME = `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="utf-8" />\n        <title>Test</title>\n        <link rel="stylesheet" href="/site.css" />\n    </head>\n    <body>\n        <h1 class="title">Test</h1>\n        <a href="/about.html">About</a>\n        <img src="/assets/logo.svg" alt="The logo" />\n    </body>\n</html>\n`;

const ABOUT = `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="utf-8" />\n        <title>Test</title>\n        <link rel="stylesheet" href="/site.css" />\n    </head>\n    <body>\n        <h1 class="title">About</h1>\n        <a href="/">Home</a>\n    </body>\n</html>\n`;

export const SITE_BUILD_SCRIPT = `import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
const hadOutput = existsSync('dist/index.html');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
// Distinguish a fresh build from a rebuild of existing output.
writeFileSync('dist/index.html', hadOutput ? 'second' : 'first');
`;

/** Policy selecting the all-level site build checks. */
export const SITE_POLICY = 'level = "all"\nconfigurations = ["site"]\n[site]\nbuild = "bun build.js"\n';

export const STATIC_SITE_FILES = {
    '.gitignore': 'node_modules\ndist\n',
    'package.json':
        '{\n    "name": "example",\n    "version": "1.0.0",\n    "private": true,\n    "description": "A test site.",\n    "type": "module",\n    "devDependencies": {\n        "@types/node": "22.18.6"\n    },\n    "scripts": {\n        "build": "bun build.js"\n    }\n}\n',
    'build.js': BUILD,
    'index.html': HOME,
    'about.html': ABOUT,
    'site.css': '.title {\n    color: #333;\n}\n',
    'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n    <url><loc>https://example.test/</loc></url>\n    <url><loc>https://example.test/about.html</loc></url>\n</urlset>\n`,
    _headers: STATIC_SITE_HEADERS,
    'site.webmanifest': '{\n    "name": "Test",\n    "icons": [{ "src": "/assets/logo.svg" }]\n}\n',
    'assets/logo.svg': SVG,
};
