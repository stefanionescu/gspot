// The runtime provides RegExp.escape before TypeScript's standard declarations include it.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- reason: TypeScript extends the built-in RegExp constructor through an interface.
interface RegExpConstructor {
    escape(text: string): string;
}

declare module 'spdx-expression-parse' {
    export default function parse(expression: string): unknown;
}

declare module 'spdx-satisfies' {
    export default function satisfies(expression: string, approved: string[]): boolean;
}
