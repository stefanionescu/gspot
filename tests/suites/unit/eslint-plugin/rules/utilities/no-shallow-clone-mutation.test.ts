import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noShallowCloneMutation } from '#eslint-plugin/rules/utilities/no-shallow-clone-mutation.ts';

buildRuleTester().run('no-shallow-clone-mutation', noShallowCloneMutation, {
    valid: [
        'import _ from "lodash"; function save(settings) { const copy = _.clone(settings); copy.theme = "dark"; }',
        'import _ from "lodash"; function save(settings) { const copy = _.cloneDeep(settings); copy.theme.color = "red"; }',
        'import _ from "lodash"; function save(settings) { const copy = _.clone(settings); copy.theme = {}; copy.theme.color = "red"; }',
        'import _ from "lodash"; function save(settings) { const copy = _.clone(settings); copy.theme = structuredClone(settings.theme); copy.theme.font.size = 1; }',
        'import _ from "lodash"; function save(settings, key) { const copy = _.clone(settings); copy[key].color = "red"; }',
        'function save(settings) { const copy = clone(settings); copy.theme.color = "red"; }',
        'import _ from "lodash"; function save(settings) { const copy = _.clone(settings); copy.theme = _.cloneDeep(settings.theme); copy.theme.font.size = 1; }',
        'import _ from "lodash"; function save(settings) { const copy = _.clone(settings); copy.theme = _.clone(settings.theme); copy.theme.color = "red"; }',
        'import _ from "lodash"; function f(k) { const copy = _.clone(settings); switch (k) { case 1: copy.theme = {}; copy.theme.color = \'red\'; break; } }',
        'import _ from "lodash"; const copy = _.clone(...sources); copy.theme.color = "red";',
    ],
    invalid: [
        {
            code: 'import _ from "lodash"; function save(settings) { const copy = _.clone(settings); copy.theme.color = "red"; }',
            errors: [{ messageId: 'shared', data: { advice: 'structuredClone() or _.cloneDeep()' } }],
        },
        {
            code: 'import { clone } from "lodash-es"; function save(settings) { const copy = clone(settings); delete copy.theme.color; copy.theme.size++; }',
            errors: [
                { messageId: 'shared', data: { advice: 'structuredClone() or _.cloneDeep()' } },
                { messageId: 'shared', data: { advice: 'structuredClone() or _.cloneDeep()' } },
            ],
        },
        {
            code: 'const _ = require("underscore"); function save(settings) { const copy = _.clone(settings); copy.theme = {}; copy.theme.font.size = 1; }',
            errors: [{ messageId: 'shared', data: { advice: 'structuredClone()' } }],
        },
        {
            code: 'import clone from "lodash/clone"; function save(settings) { const copy = clone(settings); copy.theme = settings.other; copy.theme.color = "red"; }',
            errors: [{ messageId: 'shared', data: { advice: 'structuredClone() or _.cloneDeep()' } }],
        },
        ...[
            'const copy = _.clone(settings); (copy as Settings).theme.color = "red";',
            'const copy = _.clone(settings); copy["theme"].color = "red";',
            'const copy = _.clone(settings); copy.theme ??= {}; copy.theme.color = "red";',
            'const copy = _.clone(settings); copy.theme = build(); copy.theme.color = "red";',
        ].map((code) => ({ code: `import _ from "lodash"; ${code}`, errors: [{ messageId: 'shared' as const }] })),
        {
            code: 'import _ from "lodash"; const copy = _.clone(settings); copy.items.push(1);',
            errors: [{ messageId: 'shared', data: { advice: 'structuredClone() or _.cloneDeep()' } }],
        },
    ],
});
