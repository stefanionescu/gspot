import { join } from 'node:path';

import { noDefaultUtilityImports } from '#eslint-plugin/rules/utilities/no-default-utility-imports.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({
    modern: { dependencies: { lodash: '^4.17.21', rxjs: '~7.8.0', validator: '*' } },
    old: { dependencies: { lodash: '^3.10.0', rxjs: '~7.1.0', validator: 'github:validatorjs/validator.js' } },
    capped: { dependencies: { lodash: '<=4.0.0' } },
    major: { dependencies: { lodash: '4.x' } },
    zero: { dependencies: { rambda: '^0.0' } },
});
const filename = join(root, 'modern/cart.ts');

buildRuleTester({ root }).run('no-default-utility-imports', noDefaultUtilityImports, {
    valid: [
        { code: 'import _ from "lodash";', filename: join(root, 'old/cart.ts') },
        { code: 'import rx from "rxjs";', filename: join(root, 'old/cart.ts') },
        { code: 'import validator from "validator";', filename: join(root, 'old/cart.ts') },
        { code: 'import { map } from "lodash";', filename },
        { code: 'import dayjs from "dayjs";', filename },
        { code: 'import R from "rambda";', filename: join(root, 'zero/cart.ts') },
        { code: 'import R from "rambda";', filename: join(root, 'old/cart.ts') },
        { code: 'import type _ from "lodash";', filename },
    ],
    invalid: [
        {
            code: 'import _ from "lodash";',
            filename,
            errors: [{ messageId: 'method', data: { library: 'lodash', example: 'lodash/map' } }],
        },
        { code: 'import rx from "rxjs";', filename, errors: [{ messageId: 'named', data: { library: 'rxjs' } }] },
        { code: 'import validator from "validator";', filename, errors: [{ messageId: 'method' }] },
        { code: 'import _ from "lodash";', filename: join(root, 'capped/cart.ts'), errors: [{ messageId: 'method' }] },
        { code: 'import _ from "lodash";', filename: join(root, 'major/cart.ts'), errors: [{ messageId: 'method' }] },
    ],
});
