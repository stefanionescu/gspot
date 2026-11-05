import { preferNativeJquery } from '#eslint-plugin/rules/libraries/prefer-native-jquery.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('prefer-native-jquery', preferNativeJquery, {
    valid: [
        'Array.isArray(rows);',
        'const $ = select;\n$.isArray(rows);',
        'import $ from "./dom";\n$.trim(name);',
        '$.ajax(url);',
        '$?.isArray(rows);',
    ],
    invalid: [
        {
            code: '$.isArray(rows);',
            errors: [
                { messageId: 'deprecated', data: { alternative: 'Array.isArray()', method: 'isArray' }, column: 3 },
            ],
        },
        {
            code: 'import jq from "jquery";\njq.inArray(row, rows);',
            errors: [
                { messageId: 'dependency', data: { alternative: 'Array.prototype.indexOf()', method: 'inArray' } },
            ],
        },
        { code: 'import { jQuery } from "jquery/slim";\njQuery.now();', errors: [{ messageId: 'deprecated' }] },
        { code: 'const $ = require("jquery");\n$.parseJSON(text);', errors: [{ messageId: 'deprecated' }] },
    ],
});
