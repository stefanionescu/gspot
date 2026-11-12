import { noIncompleteAssertions } from '#eslint-plugin/rules/assertions/no-incomplete-assertions.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-incomplete-assertions', noIncompleteAssertions, {
    valid: [
        'expect(total).to.equal(3);',
        'value.should.be.ok;',
        'expect(1);',
        'other.to.be;',
        'const check = expect(total).to;',
        'load().to;',
    ],
    invalid: [
        { code: 'expect(total);', errors: [{ messageId: 'complete', data: { name: 'expect' } }] },
        { code: 'expect(total).to.equal;', errors: [{ messageId: 'call', data: { name: 'equal' } }] },
        { code: 'expect(total).to.be;', errors: [{ messageId: 'complete', data: { name: 'be' } }] },
        { code: 'value.should;', errors: [{ messageId: 'complete', data: { name: 'should' } }] },
        { code: 'expect.soft(total);', errors: [{ messageId: 'complete', data: { name: 'soft' } }] },
        { code: 'await expect.poll(read).not;', errors: [{ messageId: 'complete', data: { name: 'not' } }] },
        { code: 'await expect(load()).rejects;', errors: [{ messageId: 'complete', data: { name: 'rejects' } }] },
        { code: 'assert.rejects;', errors: [{ messageId: 'call', data: { name: 'rejects' } }] },
        { code: 'expect(total).to.be.a("number").and;', errors: [{ messageId: 'complete', data: { name: 'and' } }] },
    ],
});
