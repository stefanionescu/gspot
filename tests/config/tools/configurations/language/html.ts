import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const CLEAN = `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="utf-8" />\n        <title>{{ title }}</title>\n    </head>\n    <body>\n        <h1>{{ heading }}</h1>\n        <img src="/logo.svg" alt="{{ logo_alt }}" />\n        <script type="application/ld+json">{"@type": "Thing"}</script>\n        <script src="/app.js"></script>\n    </body>\n</html>\n`;

export const REPOSITORY: RepositoryScenario = {
    configurations: ['html'],

    files: {
        'package.json': '{\n    "name": "example",\n    "version": "1.0.0",\n    "private": true\n}\n',
        'pages/home.html': CLEAN,
    },
};

export const CASES: FindingCase[] = [
    {
        check: 'html/validate',
        files: {
            'pages/home.html': `<!doctype html>\n<html lang="en">\n    <head>\n        <meta charset="utf-8" />\n        <title>{{ title }}</title>\n    </head>\n    <body>\n        <h1>{{ heading }}</h1>\n        <img src="/logo.svg" />\n    </body>\n</html>\n`,
        },
        expected: { file: 'pages/home.html', rule: 'wcag/h37', line: 9 },
    },
];
