import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('dynamic-templates', plugin.rules['dynamic-templates'], {
    valid: [
        "import pug from 'pug';\npug.render('p Hello #{name}', { name });",
        "import ejs from 'ejs';\nconst render = ejs.compile('<p><%= name %></p>');\nrender({ name });",
    ],
    invalid: [
        {
            code: "const pug = require('pug');\npug.render(`p Hello ${name}`);\npug.compile('p Hello');\npug.compile(template);\nconst fn = pug.compile('p');\nfn(data);\nimport ejs from 'ejs';\nejs.render('a' + b);\nejs.render('a' + 'b');",
            errors: [
                { messageId: 'builtTemplate', line: 2 },
                { messageId: 'builtTemplate', line: 4 },
                { messageId: 'builtTemplate', line: 8 },
            ],
        },
    ],
});
