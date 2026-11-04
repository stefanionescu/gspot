import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noTableAsLayout } from '#eslint-plugin/rules/accessibility/no-table-as-layout.ts';

buildRuleTester().run('no-table-as-layout', noTableAsLayout, {
    valid: ['const table = <table role="grid"><tr><th>Name</th></tr></table>;'],
    invalid: [
        {
            code: 'const a = <table role="presentation"><tr><td>A</td></tr></table>;\nconst b = <table role="none" />;\nconst c = <table role="grid" />;\nconst d = <table />;\nconst e = <TABLE role="PRESENTATION" />;\nconst f = <table role={`none`} />;\nconst g = <table role={role} />;',
            errors: [
                { messageId: 'layoutTable', line: 1 },
                { messageId: 'layoutTable', line: 2 },
                { messageId: 'layoutTable', line: 5 },
                { messageId: 'layoutTable', line: 6 },
            ],
        },
    ],
});
