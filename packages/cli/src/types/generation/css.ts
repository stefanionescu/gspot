export type StylelintComponent = {
    files: readonly string[];
    customSyntax: string;
    ignorePseudoClasses: readonly string[];
    functions?: readonly string[];
};
