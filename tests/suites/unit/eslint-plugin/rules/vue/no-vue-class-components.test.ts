import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { Linter } from 'eslint';

import plugin from '#eslint-plugin/plugin.ts';
import { noVueClassComponents } from '#eslint-plugin/rules/vue/no-vue-class-components.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({
    three: { dependencies: { vue: '^3.4.0' } },
    two: { dependencies: { vue: '^2.7.0' } },
    plain: {},
});
const filename = join(root, 'three/cart.ts');

buildRuleTester({ root }).run('no-vue-class-components', noVueClassComponents, {
    valid: [
        {
            code: 'import { Vue } from "vue-class-component";\nexport class Cart extends Vue {}',
            filename: join(root, 'two/cart.ts'),
        },
        {
            code: 'import { Vue } from "vue-class-component";\nexport class Cart extends Vue {}',
            filename: join(root, 'plain/cart.ts'),
        },
        { code: 'import { Vue } from "./vue";\nexport class Cart extends Vue {}', filename },
        { code: 'function Prop() {}\nexport class Cart { @Prop() total = 0; }', filename },
    ],
    invalid: [
        {
            code: 'import { Vue } from "vue-class-component";\nexport class Cart extends Vue {}',
            filename,
            errors: [{ messageId: 'classComponent', line: 2, column: 14 }],
        },
        {
            code: 'import Component from "vue-class-component";\n@Component\nexport default class extends Base {}',
            filename,
            errors: [{ messageId: 'classComponent' }],
        },
        {
            code: 'import { Prop } from "vue-property-decorator";\nexport class Cart { @Prop() total = 0; }',
            filename,
            errors: [{ messageId: 'classComponent', line: 2 }],
        },
    ],
});

test('a JavaScript class from the default parser, which sets no decorators field, is linted without a finding', () => {
    const linter = new Linter({ configType: 'flat', cwd: root });
    const config: object = {
        plugins: { gspot: plugin },
        rules: { 'gspot/no-vue-class-components': 'error' },
        settings: { gspot: { root } },
    };
    const source = 'export class Clock {\n    read() {\n        return 1;\n    }\n}\n';
    expect(linter.verify(source, config, join(root, 'three/clock.js'))).toStrictEqual([]);
});
