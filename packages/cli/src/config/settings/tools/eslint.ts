export const ESLINT_OPTION_STRING = /^(?!(?:off|warn|error)$)[\s\S]*$/u;

export const ESLINT_PLUGIN_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

/** Your own ESLint plugin: an ES module that Node loads without a build step. */
export const ESLINT_PLUGIN_MODULE = /\.m?js$/u;
