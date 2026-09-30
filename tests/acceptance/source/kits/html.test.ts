// Planted repository for the html configuration: an image with no text alternative, an inline handler, and copy written into a template.
import { plantedCases } from '#tests/support/cli/planted.ts';
import { TEMPLATES } from '#tests/inputs/acceptance/source/kits/kits.ts';

const CLEAN = `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="utf-8" />\n        <title>{{ title }}</title>\n    </head>\n    <body>\n        <h1>{{ heading }}</h1>\n        <img src="/logo.svg" alt="{{ logo_alt }}" />\n        <script type="application/ld+json">{"@type": "Thing"}</script>\n        <script src="/app.js"></script>\n    </body>\n</html>\n`;

plantedCases(
    'the html configuration',
    {
        kits: ['html'],
        without: ['spelling'],
        files: {
            'package.json': '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true\n}\n',
            'pages/home.html': CLEAN,
        },
    },
    [
        {
            check: 'html/html-validate',
            files: {
                'pages/home.html': `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="utf-8" />\n        <title>{{ title }}</title>\n    </head>\n    <body>\n        <h1>{{ heading }}</h1>\n        <img src="/logo.svg" />\n    </body>\n</html>\n`,
            },
            expected: { file: 'pages/home.html', rule: 'wcag/h37', line: 9 },
        },
        {
            check: 'html/scripts',
            files: {
                'pages/home.html': `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="utf-8" />\n        <title>{{ title }}</title>\n    </head>\n    <body>\n        <button type="button" onclick="go()">{{ label }}</button>\n    </body>\n</html>\n`,
            },
            expected: { file: 'pages/home.html', rule: 'handler-attribute', line: 8 },
        },
        {
            check: 'html/scripts',
            files: {
                'pages/home.html': `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="utf-8" />\n        <title>{{ title }}</title>\n    </head>\n    <body>\n        <script>window.go = 1;</script>\n    </body>\n</html>\n`,
            },
            expected: { file: 'pages/home.html', rule: 'inline-script', line: 8 },
        },
        {
            check: 'html/text',
            files: {
                'pages/home.html': `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="utf-8" />\n        <title>{{ title }}</title>\n    </head>\n    <body>\n        <h1>Welcome to the shop</h1>\n    </body>\n</html>\n`,
            },
            policy: TEMPLATES,
            expected: { file: 'pages/home.html', rule: 'literal-text', line: 8 },
        },
    ],
);
