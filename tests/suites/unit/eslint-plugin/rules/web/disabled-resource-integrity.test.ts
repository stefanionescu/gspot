import { disabledResourceIntegrity } from '#eslint-plugin/rules/web/disabled-resource-integrity.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildTypedRuleTester().run('disabled-resource-integrity', disabledResourceIntegrity, {
    valid: [
        "const script = document.createElement('script');\nscript.src = 'https://cdn.example.com/v5.3.0/lib.js';\nscript.integrity = 'sha384-abc';\nscript.crossOrigin = 'anonymous';",
        "const script = document.createElement('script');\nscript.src = 'https://cdn.example.com/latest/lib.js';",
        "const script = document.createElement('script');\nscript.src = '/assets/lib@1.2.3/lib.js';",
        "const panel = document.createElement('div');\npanel.id = 'lib@1.2.3';",
    ],
    invalid: [
        {
            code: "const script = document.createElement('script');\nscript.src = 'https://cdn.example.com/lib@1.2.3/lib.js';",
            errors: [{ messageId: 'missingBoth', line: 1 }],
        },
        {
            code: "const script = document.createElement('script');\nscript.src = 'https://cdn.example.com/1.2.3/lib.js';\nscript.integrity = 'sha384-abc';",
            errors: [{ messageId: 'missingCrossOrigin', line: 1 }],
        },
        {
            code: "const script = document.createElement('script');\nscript.src = '//cdn.example.com/jquery@3.7.1/jquery.min.js';\nscript.crossOrigin = 'anonymous';",
            errors: [{ messageId: 'missingIntegrity', line: 1 }],
        },
    ],
});

buildRuleTester().run('disabled-resource-integrity', disabledResourceIntegrity, {
    valid: [
        "const script = document.createElement('script');\nscript.src = 'https://cdn.example.com/lib@1.2.3/lib.js';",
    ],
    invalid: [],
});
