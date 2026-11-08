import { noTableAsLayout } from '#eslint-plugin/rules/accessibility/no-table-as-layout.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-table-as-layout', noTableAsLayout, {
    valid: ['const table = <table role="grid"><tr><th>Name</th></tr></table>;'],
    invalid: [
        {
            code: 'const e = <TABLE role="PRESENTATION" />;\nconst f = <table role={`none`} />;\nconst g = <table role={role} />;',
            errors: [
                { messageId: 'layoutTable', line: 1 },
                { messageId: 'layoutTable', line: 2 },
            ],
        },
    ],
});
