/** The globals of an ESLint block: each name, and whether code may write it. */
export type EslintGlobals = Record<string, boolean | 'readonly' | 'writable' | 'writeable' | 'off'>;

/** An ESLint block, with the language options that name its globals. */
export type JavascriptBlock = {
    languageOptions?: { globals?: EslintGlobals; [option: string]: unknown };
    [field: string]: unknown;
};

/** A script attribute of a Vue component, as vue-eslint-parser reads it. */
type VueAttribute = { key?: { name?: string }; value?: { value?: string } | null };

/** A script attribute of a Svelte component, as svelte-eslint-parser reads it. */
type SvelteAttribute = { key?: { name?: string }; value: { value?: string }[] };

/** A top-level element of a component, as the component parsers read it. */
type ComponentElement<Attribute> = { type: string; name?: string; startTag: { attributes: Attribute[] } };

/**
 * vue-eslint-parser or svelte-eslint-parser. Only vue-eslint-parser gives the getDocumentFragment service, which lists
 * the top-level elements of a Vue component; svelte-eslint-parser lists them as the body of its syntax tree.
 */
export type ComponentParser = {
    parseForESLint: (
        text: string,
        options: object,
    ) => {
        services?: { getDocumentFragment?: () => { children: ComponentElement<VueAttribute>[] } };
        ast: { body: ComponentElement<SvelteAttribute>[] };
    };
};
