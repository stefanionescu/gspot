import { noCodeEval } from '#eslint-plugin/rules/security/no-code-eval.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-code-eval', noCodeEval, {
    valid: ["eval('2 + 2');\nnew Function('return 1');", "const url = 'javascript:void(0)';\nrun(`label: ${name}`);"],
    invalid: [
        {
            code: "eval(code);\neval('1 + 1');\nnew Function(body);\nFunction('return 1');\nconst vm = require('vm');\nvm.runInThisContext(code);\nnew vm.Script(code);\nvm.runInNewContext('1');\nconst url = `javascript:${code}`;\nconst link = 'javascript:' + code;\nconst safe = 'javascript:void(0)';\nconst other = 'https:' + host;\nconst nested = 'javascript:' + a + 'b';",
            errors: [
                { messageId: 'dynamicCode', line: 1 },
                { messageId: 'dynamicCode', line: 3 },
                { messageId: 'dynamicCode', line: 6 },
                { messageId: 'dynamicCode', line: 7 },
                { messageId: 'scriptUrl', line: 9 },
                { messageId: 'scriptUrl', line: 10 },
                { messageId: 'scriptUrl', line: 13 },
            ],
        },
    ],
});
