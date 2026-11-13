import { dynamicTemplates } from '#eslint-plugin/rules/security/dynamic-templates.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('dynamic-templates', dynamicTemplates, {
    valid: ["import ejs from 'ejs';\nconst render = ejs.compile('<p><%= name %></p>');\nrender({ name });"],
    invalid: [
        {
            code: "const pug = require('pug');\npug.render(`p Hello ${name}`);\npug.compile(template);\nimport ejs from 'ejs';\nejs.render('a' + b);\nejs.render('a' + 'b');",
            errors: [
                { messageId: 'builtTemplate', line: 2 },
                { messageId: 'builtTemplate', line: 3 },
                { messageId: 'builtTemplate', line: 5 },
            ],
        },
        { code: 'import { compile } from "pug";\ncompile(value + "b");', errors: [{ messageId: 'builtTemplate' }] },
    ],
});
