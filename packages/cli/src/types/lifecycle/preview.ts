// The types of lifecycle/preview in this package.

// Reading vale.ini without Vale: the styles and rule levels of each file-pattern section.
export type Reader = { lines: string[]; index: number };
export type Section = Map<string, string[]>;

// Reading a .shellcheckrc without ShellCheck: the rules its directives enable and disable.
export type Rules = { enable: string[]; disable: string[] };
export type Directive = { key: string; value: string; remaining: string };

/** One line of a SQLFluff configuration file: the section it opens, or the continuation it carries. */
export type SqlfluffLine = {
    number: number;
    text: string;
    continuation: string;
    indentation: number;
    heading: string | undefined;
};
