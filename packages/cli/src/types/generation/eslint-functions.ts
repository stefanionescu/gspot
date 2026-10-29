export type EslintGlobals = Record<string, boolean | 'readonly' | 'writable' | 'writeable' | 'off'>;

export type JavascriptBlock = {
    rules?: Record<string, unknown>;
    plugins?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    languageOptions?: { globals?: EslintGlobals; [option: string]: unknown };
    [field: string]: unknown;
};

type VueAttribute = { key?: { name?: string }; value?: { value?: string } | null };

type SvelteAttribute = { key?: { name?: string }; value: { value?: string }[] };

type ComponentElement<Attribute> = { type: string; name?: string; startTag: { attributes: Attribute[] } };

export type ComponentParser = {
    parseForESLint: (
        text: string,
        options: object,
    ) => {
        services?: { getDocumentFragment?: () => { children: ComponentElement<VueAttribute>[] } };
        ast: { body: ComponentElement<SvelteAttribute>[] };
    };
};
