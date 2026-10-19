export const HOST_MODULE = '../../scripts/app.js';

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
