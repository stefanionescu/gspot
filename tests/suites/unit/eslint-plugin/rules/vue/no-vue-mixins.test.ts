import { join } from 'node:path';

import { noVueMixins } from '#eslint-plugin/rules/vue/no-vue-mixins.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({ three: { dependencies: { vue: '>=3' } }, two: { dependencies: { vue: '2.6.14' } } });
const filename = join(root, 'three/cart.ts');

buildRuleTester({ root }).run('no-vue-mixins', noVueMixins, {
    valid: [
        { code: 'export default { mixins: [tracking] };', filename: join(root, 'two/cart.ts') },
        { code: 'export default { mixins: tracking };', filename },
        { code: 'export default { setup() { useTracking(); } };', filename },
    ],
    invalid: [
        { code: 'export default { mixins: [tracking] };', filename, errors: [{ messageId: 'mixin', column: 18 }] },
        {
            code: 'const shared = [tracking];\nexport default defineComponent({ "mixins": shared });',
            filename,
            errors: [{ messageId: 'mixin', line: 2 }],
        },
    ],
});
