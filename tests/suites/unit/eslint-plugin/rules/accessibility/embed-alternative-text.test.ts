import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { embedAlternativeText } from '#eslint-plugin/rules/accessibility/embed-alternative-text.ts';

buildRuleTester().run('embed-alternative-text', embedAlternativeText, {
    valid: [
        'const chart = <object data="chart.svg">Sales by month</object>;',
        'const a = <object data="x"><input type="text" /></object>;',
        'const d = <object data="x">{label}</object>;',
        'const g = <object data="x"><><em>Chart</em></></object>;',
    ],
    invalid: [
        { code: 'const a = <object data="x">{/* chart */}</object>;', errors: [{ messageId: 'missingContent' }] },
        { code: 'const a = <object data="x">{...items}</object>;', errors: [{ messageId: 'missingContent' }] },

        {
            code: 'const a = <object data="x.svg" />;\nconst c = <object data="x"><span aria-hidden="true">x</span></object>;\nconst e = <object data="x">{undefined}</object>;\nconst f = <object data="x"><input type="hidden" /></object>;\nconst h = <object>   </object>;',
            errors: [
                { messageId: 'missingContent', line: 1 },
                { messageId: 'missingContent', line: 2 },
                { messageId: 'missingContent', line: 3 },
                { messageId: 'missingContent', line: 4 },
                { messageId: 'missingContent', line: 5 },
            ],
        },
    ],
});
