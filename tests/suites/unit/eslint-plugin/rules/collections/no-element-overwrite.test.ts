import { noElementOverwrite } from '#eslint-plugin/rules/collections/no-element-overwrite.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-element-overwrite', noElementOverwrite, {
    valid: [
        'map.set(load(), 1);\nmap.set(load(), 2);',

        'labels[1] = "first"; names[1] = "second"; labels[1] = "third";',
        'labels[key] = 1; labels[key] = labels[key] + 1;',
        'labels[key] = 1; notify(); labels[key] = 2;',
        'labels.first = 1; labels.first = 2;',
        'queue.push("a"); queue.push("a");',
    ],
    invalid: [
        {
            code: 'function fill(map) { map.set("a", 1); map.set("a", 2); }',
            errors: [{ messageId: 'overwrite', data: { key: 'a', line: 1 } }],
        },

        {
            code: 'labels[0] = "first"; labels[1] = "other"; labels[0] = "second";',
            errors: [{ messageId: 'overwrite', data: { key: '0', line: 1 } }],
        },
        {
            code: 'switch (mode) { case 1: labels[index] = 1; labels[index] = 2; }',
            errors: [{ messageId: 'overwrite', data: { key: 'index', line: 1 } }],
        },
    ],
});
