import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-shallow-clone-mutation', plugin.rules['no-shallow-clone-mutation'], {
    valid: [
        'import _ from "lodash"; function save(settings) { const copy = _.clone(settings); copy.theme = "dark"; }',
        'import _ from "lodash"; function save(settings) { const copy = _.cloneDeep(settings); copy.theme.color = "red"; }',
        'import _ from "lodash"; function save(settings) { const copy = _.clone(settings); copy.theme = {}; copy.theme.color = "red"; }',
        'import _ from "lodash"; function save(settings) { const copy = _.clone(settings); copy.theme = structuredClone(settings.theme); copy.theme.font.size = 1; }',
        'import _ from "lodash"; function save(settings, key) { const copy = _.clone(settings); copy[key].color = "red"; }',
        'function save(settings) { const copy = clone(settings); copy.theme.color = "red"; }',
    ],
    invalid: [
        {
            code: 'import _ from "lodash"; function save(settings) { const copy = _.clone(settings); copy.theme.color = "red"; }',
            errors: [{ messageId: 'shared', data: { advice: 'structuredClone() or _.cloneDeep()' } }],
        },
        {
            code: 'import { clone } from "lodash-es"; function save(settings) { const copy = clone(settings); delete copy.theme.color; copy.theme.size++; }',
            errors: [{ messageId: 'shared' }, { messageId: 'shared' }],
        },
        {
            code: 'const _ = require("underscore"); function save(settings) { const copy = _.clone(settings); copy.theme = {}; copy.theme.font.size = 1; }',
            errors: [{ messageId: 'shared', data: { advice: 'structuredClone()' } }],
        },
        {
            code: 'import clone from "lodash/clone"; function save(settings) { const copy = clone(settings); copy.theme = settings.other; copy.theme.color = "red"; }',
            errors: [{ messageId: 'shared' }],
        },
    ],
});
