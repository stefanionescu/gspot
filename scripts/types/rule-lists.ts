/** Stylelint's callable default export carries its public resolver method. */
export type StylelintModule = {
    [method in 'resolveConfig']: (file: string, options: { config: { extends: string } }) => Promise<unknown>;
};
