/** The authored scope and declaration exclusions for one JavaScript compiler configuration. */
export type JsconfigInput = {
    root: string;
    declarationPaths: string[];
    target: string;
    scope: string;
};
