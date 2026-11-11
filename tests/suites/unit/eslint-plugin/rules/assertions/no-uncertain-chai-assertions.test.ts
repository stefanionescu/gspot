import { noUncertainChaiAssertions } from '#eslint-plugin/rules/assertions/no-uncertain-chai-assertions.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-uncertain-chai-assertions', noUncertainChaiAssertions, {
    valid: [
        'expect(run).to.not.throw(TypeError);',
        'import { expect } from "chai";\nexpect(run).to.not.throw();',
        'import { expect } from "chai";\nexpect(cart).to.not.include("apple");',
        'import { expect } from "chai";\nexpect(cart).to.not.have.property("total");',
        'import { expect } from "chai";\nexpect(run).to.change(cart, "total");',
        'import { expect } from "chai";\nother(run).to.not.throw(TypeError);',
    ],
    invalid: [
        {
            code: 'import { expect } from "chai";\nexpect(run).to.not.throw(TypeError);',
            errors: [{ messageId: 'uncertain', line: 2, column: 16, endColumn: 25 }],
        },
        ...['expect(cart).to.not.include({ total: 3 });', 'expect(cart).to.not.have.property("total", 3);'].map(
            (assertion) => ({
                code: `import { expect } from "chai";\n${assertion}`,
                errors: [{ messageId: 'uncertain' as const }],
            }),
        ),
        {
            code: 'import "chai";\nlist.should.not.have.members([1]);',
            errors: [{ messageId: 'uncertain' }],
        },
        {
            code: 'import { expect } from "chai";\nexpect(run).to.change(cart, "total").by(1);',
            errors: [{ messageId: 'uncertain' }],
        },
    ],
});
