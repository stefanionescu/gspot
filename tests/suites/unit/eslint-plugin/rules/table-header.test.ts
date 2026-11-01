import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('table-header', plugin.rules['table-header'], {
    valid: [
        'const table = <table><tr><th>Name</th></tr><tr><td>Ada</td></tr></table>;',
        'const table = <table>{rows}</table>;',
    ],
    invalid: [
        {
            code: 'const a = <table><tr><td>A</td><td>B</td></tr></table>;\nconst b = <table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>;\nconst c = <table><tr><th>A</th><td>1</td></tr><tr><th>B</th><td>2</td></tr></table>;\nconst d = <table role="presentation"><tr><td>A</td></tr></table>;\nconst e = <table>{rows}</table>;\nconst f = <table><Row /></table>;\nconst g = <table aria-hidden="true"><tr><td>A</td></tr></table>;\nconst h = <table {...props} />;\nconst i = <table></table>;\nconst j = <table><tr><th rowSpan={2}>A</th><td>1</td></tr><tr><td>2</td></tr></table>;\nconst k = <table><tr><th colSpan="2">A</th></tr><tr><td>1</td><td>2</td></tr></table>;',
            errors: [
                { messageId: 'missingHeader', line: 1 },
                { messageId: 'missingHeader', line: 9 },
            ],
        },
    ],
});
