import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';
import { noVueClassComponents } from '#eslint-plugin/rules/vue/no-vue-class-components.ts';

const root = writePackageFolders({
    three: { dependencies: { vue: '^3.4.0' } },
    two: { dependencies: { vue: '^2.7.0' } },
    plain: {},
    template: {},
    empty: {},
});
writeFileSync(join(root, 'template/package.json'), '{ "name": <%= name %> }');
writeFileSync(join(root, 'empty/package.json'), 'null');
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
        { code: 'export {};', filename: join(root, 'template/cart.ts') },
        { code: 'export {};', filename: join(root, 'empty/cart.ts') },
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
