import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('embed-alternative-text', plugin.rules['embed-alternative-text'], {
    valid: ['const chart = <object data="chart.svg">Sales by month</object>;'],
    invalid: [
        {
            code: 'const a = <object data="x.svg" />;\nconst b = <object data="x.svg">Chart</object>;\nconst c = <object data="x"><span aria-hidden="true">x</span></object>;\nconst d = <object data="x">{label}</object>;\nconst e = <object data="x">{undefined}</object>;\nconst f = <object data="x"><input type="hidden" /></object>;\nconst g = <object data="x"><><em>Chart</em></></object>;\nconst h = <object>   </object>;',
            errors: [
                { messageId: 'missingContent', line: 1 },
                { messageId: 'missingContent', line: 3 },
                { messageId: 'missingContent', line: 5 },
                { messageId: 'missingContent', line: 6 },
                { messageId: 'missingContent', line: 8 },
            ],
        },
    ],
});
