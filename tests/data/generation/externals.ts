/** A host application module that a web extension imports by a path outside the repository. */
export const HOST_MODULE = '../../scripts/app.js';

/** A project-local ESLint plugin with one rule that reports the identifier forbidden. */
export const LOCAL_PLUGIN = `export default {
    rules: {
        'no-forbidden': {
            meta: { type: 'problem', schema: [] },
            create(context) {
                return {
                    Identifier(node) {
                        if (node.name === 'forbidden') context.report({ node, message: 'Use the current API.' });
                    },
                };
            },
        },
    },
};
`;

export const LOCAL_PLUGIN_TABLES = `[[tools.eslint.plugins]]
name = "local"
path = "tools/lint/plugin.mjs"
rules = { "no-forbidden" = [] }
`;
