declare module 'spdx-expression-parse' {
    export default function parse(expression: string): unknown;
}

declare module 'spdx-satisfies' {
    export default function satisfies(expression: string, approved: string[]): boolean;
}
