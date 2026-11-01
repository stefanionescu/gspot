import { join } from 'node:path';
import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({
    three: { dependencies: { vue: '^3.4.0' } },
    two: { dependencies: { vue: '^2.7.0' } },
    plain: {},
});
const filename = join(root, 'three/cart.ts');

buildRuleTester({ root }).run('no-vue-class-components', plugin.rules['no-vue-class-components'], {
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
