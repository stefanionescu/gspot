import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-element-overwrite', plugin.rules['no-element-overwrite'], {
    valid: [
        'list.push(1);',
        'map.set(load(), 1);\nmap.set(load(), 2);',
        'await load();',

        'labels[1] = "first"; names[1] = "second"; labels[1] = "third";',
        'labels[key] = 1; labels[key] = labels[key] + 1;',
        'labels[key] = 1; notify(); labels[key] = 2;',
        'labels.first = 1; labels.first = 2;',
    ],
    invalid: [
        { code: 'function fill(map) { map.set("a", 1); map.set("a", 2); }', errors: [{ messageId: 'overwrite' }] },

        {
            code: 'labels[0] = "first"; labels[0] = "second";',
            errors: [{ messageId: 'overwrite', data: { key: '0', line: 1 } }],
        },
        { code: 'cache.set("key", 1); cache.set("key", 2);', errors: [{ messageId: 'overwrite' }] },
        { code: 'seen.add(1); seen.add(1);', errors: [{ messageId: 'overwrite' }] },
        { code: 'labels[1] = 1; labels[2] = 2; labels[1] = 3;', errors: [{ messageId: 'overwrite' }] },
        {
            code: 'switch (mode) { case 1: labels[index] = 1; labels[index] = 2; }',
            errors: [{ messageId: 'overwrite', data: { key: 'index', line: 1 } }],
        },
    ],
});
