import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noCodeEval } from '#eslint-plugin/rules/security/no-code-eval.ts';

buildRuleTester().run('no-code-eval', noCodeEval, {
    valid: ["eval('2 + 2');", "const url = 'javascript:void(0)';\nrun(`label: ${name}`);"],
    invalid: [
        {
            code: "eval(code);\nnew Function(body);\nconst vm = require('vm');\nvm.runInThisContext(code);\nconst url = `javascript:${code}`;\nconst link = 'javascript:' + code;\nconst other = 'https:' + host;\nconst nested = 'javascript:' + a + 'b';",
            errors: [
                { messageId: 'dynamicCode', line: 1 },
                { messageId: 'dynamicCode', line: 2 },
                { messageId: 'dynamicCode', line: 4 },
                { messageId: 'scriptUrl', line: 5 },
                { messageId: 'scriptUrl', line: 6 },
                { messageId: 'scriptUrl', line: 8 },
            ],
        },
    ],
});
