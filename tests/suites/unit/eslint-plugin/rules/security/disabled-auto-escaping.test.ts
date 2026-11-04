import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { disabledAutoEscaping } from '#eslint-plugin/rules/security/disabled-auto-escaping.ts';

buildRuleTester().run('disabled-auto-escaping', disabledAutoEscaping, {
    valid: [
        "import Handlebars from 'handlebars';\nHandlebars.compile(source);",
        "import Mustache from 'mustache';\nMustache.escape = (text) => escapeHtml(text);",
    ],
    invalid: [
        {
            code: "const Handlebars = require('handlebars');\nHandlebars.compile(source, { noEscape: true });\nHandlebars.compile(source, { noEscape: false });\nconst marked = require('marked');\nmarked.setOptions({ sanitize: false });\nconst markdownIt = require('markdown-it');\nmarkdownIt({ html: true });\nconst swig = require('swig');\nswig.setDefaults({ autoescape: false });\nconst kramed = require('kramed');\nnew kramed.Renderer({ sanitize: false });\nconst Mustache = require('mustache');\nMustache.escape = function (text) { return text; };\nMustache.escape = (text) => text;\nMustache.escape = (text) => escapeHtml(text);",
            errors: [
                { messageId: 'unescaped', line: 2 },
                { messageId: 'unescaped', line: 5 },
                { messageId: 'unescaped', line: 7 },
                { messageId: 'unescaped', line: 9 },
                { messageId: 'unescaped', line: 11 },
                { messageId: 'unescaped', line: 13 },
                { messageId: 'unescaped', line: 14 },
            ],
        },
        { code: 'Mustache.escape = (text) => text;', errors: [{ messageId: 'unescaped' }] },
    ],
});
