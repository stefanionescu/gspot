import type { TSESTree } from '@typescript-eslint/utils';

import { UTILITY_LIBRARIES } from '../../config/utilities.ts';
import { allowsVersion, readPackageFacts } from '../../language/packages.ts';
import { createRule } from '../../rule.ts';

export const noDefaultUtilityImports = createRule<[], 'named' | 'method'>({
    name: 'no-default-utility-imports',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports a default import of lodash, lodash-es, rxjs, rambda, or validator when the version range in package.json allows named or per-method imports.',
            why: 'A default import pulls the whole library into the bundle, even when the code uses one function.',
            fix: 'Import the functions you use by name, or import each lodash or validator method from its own path.',
            example: '`import _ from "lodash";` reports `method`. Write `import map from "lodash/map";`.',
        },
        schema: [],
        messages: {
            named: 'Use named imports from "{{library}}" instead of a default import.',
            method: 'Import {{library}} methods from subpaths such as "{{example}}" to avoid importing more code than needed.',
        },
    },
    create(context) {
        const versions = readPackageFacts(context).dependencies;
        return {
            'ImportDeclaration[importKind!="type"]:has(ImportDefaultSpecifier):not(:has(ImportNamespaceSpecifier))':
                function (node: TSESTree.ImportDeclaration) {
                    const library = node.source.value;
                    const recommendation = UTILITY_LIBRARIES.get(library);
                    const range = versions.get(library);
                    if (
                        recommendation === undefined ||
                        range === undefined ||
                        allowsVersion(range, recommendation.minimum) !== true
                    )
                        return;
                    const { example } = recommendation;
                    context.report({
                        node,
                        messageId: example === undefined ? 'named' : 'method',
                        data: { library, example },
                    });
                },
        };
    },
});
