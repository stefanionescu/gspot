import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('require-memoize-key', plugin.rules['require-memoize-key'], {
    valid: [
        'import { memoize } from "lodash";\nexport const price = memoize((id) => load(id));',
        'import { memoize } from "lodash";\nexport const price = memoize((id, rate) => id * rate, (id, rate) => `${id}:${rate}`);',
        'import { memoize } from "./cache";\nexport const price = memoize((id, rate) => id * rate);',
        'import { memoize } from "lodash";\nexport const price = memoize(function (this: Cart, id: string) { return id; });',
        'import { memoize } from "lodash";\nexport function cache(read, options) { return memoize(read); }',
    ],
    invalid: [
        {
            code: 'import { memoize } from "lodash";\nexport const price = memoize((id, rate) => id * rate);',
            errors: [{ messageId: 'keyFunction', line: 2, column: 22 }],
        },
        {
            code: 'import _ from "underscore";\nfunction total(...values) { return values.length; }\nexport const cached = _.memoize(total, undefined);',
            errors: [{ messageId: 'keyFunction', line: 3, column: 25 }],
        },
        {
            code: 'import memoize from "lodash/memoize";\nconst rate = (from, to) => from / to;\nexport const cached = memoize(rate, null);',
            errors: [{ messageId: 'keyFunction', line: 3 }],
        },
        {
            code: 'import memoize from "lodash/memoize";\nconst read = memoize((a, b) => a + b, void 0);',
            errors: [{ messageId: 'keyFunction' }],
        },
    ],
});
