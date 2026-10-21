export type XcodeStrings = {
    sourceLanguage?: string | undefined;
    strings?:
        | Record<string, { shouldTranslate?: boolean | undefined; localizations?: Record<string, unknown> | undefined }>
        | undefined;
};

export type AssetContents = { images?: { filename?: string | undefined }[] | undefined };
