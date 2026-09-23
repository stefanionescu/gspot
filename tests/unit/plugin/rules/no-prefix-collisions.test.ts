import { tester } from '#tests/support/plugin/tester.ts';
import { plantedRoot } from '#tests/support/plugin/planted.ts';
import { noPrefixCollisions } from '#plugin/rules/no-prefix-collisions.ts';

const root = await plantedRoot({
    'src/cards/asset-card.ts': '',
    'src/cards/asset-list.ts': '',
    'src/cards/asset-row.ts': '',
    'src/cards/other.ts': '',
    'src/mixed/turn.ts': '',
    'src/mixed/turn-flow/x.ts': '',
    'src/fine/a.ts': '',
    'src/fine/b.ts': '',
    'src/fine/index.ts': '',
    'src/fine/index-page.ts': '',
    'tests/harness/start-call/api.ts': '',
    'tests/harness/start-call/api-two.ts': '',
});

tester(root).run('no-prefix-collisions', noPrefixCollisions, {
    valid: [
        { code: '', filename: `${root}/src/cards/other.ts` },
        { code: '', filename: `${root}/src/fine/a.ts` },
        { code: '', filename: `${root}/src/fine/index-page.ts` },
        { code: '', filename: `${root}/src/cards/asset-card.ts`, options: [{ threshold: 4 }] },
        { code: '', filename: `${root}/src/cards/asset-card.ts`, options: [{ scope: ['tests'] }] },
        {
            code: '',
            filename: `${root}/tests/harness/start-call/api.ts`,
            options: [{ allow: ['tests/harness/start-call'] }],
        },
    ],
    invalid: [
        {
            code: '',
            filename: `${root}/src/cards/asset-card.ts`,
            errors: [
                {
                    messageId: 'collision',
                    data: { prefix: 'asset', names: 'asset-card.ts, asset-list.ts, asset-row.ts' },
                },
            ],
        },
        {
            code: '',
            filename: `${root}/src/mixed/turn.ts`,
            errors: [{ messageId: 'collision', data: { prefix: 'turn', names: 'turn-flow/, turn.ts' } }],
        },
        { code: '', filename: `${root}/tests/harness/start-call/api.ts`, errors: [{ messageId: 'collision' }] },
    ],
});
