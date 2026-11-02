import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-incomplete-assertions', plugin.rules['no-incomplete-assertions'], {
    valid: [
        'expect(total).to.equal(3);',
        'value.should.be.ok;',
        'await expect(load()).rejects.toThrow();',
        'expect(1);',
        'other.to.be;',
        'const check = expect(total).to;',
    ],
    invalid: [
        { code: 'expect(total);', errors: [{ messageId: 'complete', data: { name: 'expect' } }] },
        { code: 'expect(total).to.equal;', errors: [{ messageId: 'call', data: { name: 'equal' } }] },
        { code: 'expect(total).to.be;', errors: [{ messageId: 'complete', data: { name: 'be' } }] },
        { code: 'value.should;', errors: [{ messageId: 'complete', data: { name: 'should' } }] },
        { code: 'value.should.be.above;', errors: [{ messageId: 'call', data: { name: 'above' } }] },
        { code: 'assert.strictEqual;', errors: [{ messageId: 'call', data: { name: 'strictEqual' } }] },
        { code: 'expect.soft(total);', errors: [{ messageId: 'complete', data: { name: 'soft' } }] },
        { code: 'await expect.poll(read).not;', errors: [{ messageId: 'complete', data: { name: 'not' } }] },
        { code: 'expect.soft;', errors: [{ messageId: 'complete', data: { name: 'soft' } }] },
    ],
});
