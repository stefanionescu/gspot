import {
    MISSING_TSCONFIG_RULE,
    type STRICT_FAMILY_OPTIONS,
    UNREADABLE_TSCONFIG_RULE,
} from '#cli/config/configurations/language.ts';
import type { COMPILER_OPTIONS, NESTJS_COMPILER_OPTIONS } from '#cli/config/configurations/registry.ts';
import type { RuleExplanation } from '#cli/types/tools.ts';

export const TSCONFIG_EXPLANATIONS = {
    [MISSING_TSCONFIG_RULE]: {
        description: 'A scope with TypeScript files has a `tsconfig.json`.',
        why: 'Without one, the type checks and the typed lint rules have no project to read.',
        fix: 'Create `tsconfig.json` in the scope folder; it can extend a shared tsconfig.',
        example: 'A scope with `src/index.ts` and no `tsconfig.json` reports `missing`.',
    },
    [UNREADABLE_TSCONFIG_RULE]: {
        description: 'Each tsconfig of the scope loads, with every config that it extends.',
        why: 'The type checks and the typed lint rules skip a project whose tsconfig fails to load.',
        fix: 'Install the package that the tsconfig extends, or correct the file. For a template that nobody installs, ignore its path with a reason.',
        example:
            'A tsconfig that extends `@tsconfig/svelte/tsconfig.json` while that package is not installed reports `unreadable`.',
    },
    strict: {
        description: '`strict` is on.',
        why: 'It turns on the strict family of type checks, such as `strictNullChecks`.',
        fix: 'Set `"strict": true` under `compilerOptions`.',
        example: 'A tsconfig without `"strict": true` reports `strict`.',
    },
    noUncheckedIndexedAccess: {
        description: 'At level `all`, `noUncheckedIndexedAccess` is on.',
        why: 'Without it, an index read has the element type even when the element is missing.',
        fix: 'Set `"noUncheckedIndexedAccess": true` under `compilerOptions`.',
        example: 'With the option on, `names[0]` has the type `string | undefined`.',
    },
    exactOptionalPropertyTypes: {
        description: 'At level `all`, `exactOptionalPropertyTypes` is on.',
        why: 'Without it, an optional property accepts `undefined`, so a missing key and an `undefined` value look alike.',
        fix: 'Set `"exactOptionalPropertyTypes": true` under `compilerOptions`.',
        example: 'With the option on, `{ title?: string }` refuses `{ title: undefined }`.',
    },
    noImplicitOverride: {
        description: 'At level `all`, `noImplicitOverride` is on.',
        why: 'Without it, a rename of a base method leaves the subclass method in place without an error.',
        fix: 'Set `"noImplicitOverride": true` under `compilerOptions`.',
        example: 'With the option on, a subclass method that replaces `render()` needs `override render()`.',
    },
    noFallthroughCasesInSwitch: {
        description: 'At level `all`, `noFallthroughCasesInSwitch` is on.',
        why: 'A `case` that runs into the next one runs code that the reader does not expect.',
        fix: 'Set `"noFallthroughCasesInSwitch": true` under `compilerOptions`.',
        example: 'With the option on, a `case` with statements and no `break` or `return` fails.',
    },
    noImplicitReturns: {
        description: 'At level `all`, `noImplicitReturns` is on.',
        why: 'A function that returns a value on some paths returns `undefined` on the others.',
        fix: 'Set `"noImplicitReturns": true` under `compilerOptions`.',
        example: 'With the option on, a function that returns only inside its `if` fails.',
    },
    noPropertyAccessFromIndexSignature: {
        description: 'At level `all`, `noPropertyAccessFromIndexSignature` is on.',
        why: 'Dot access hides that a key of an index signature can be missing.',
        fix: 'Set `"noPropertyAccessFromIndexSignature": true` under `compilerOptions`.',
        example: 'With the option on, `env: Record<string, string>` needs `env["HOME"]` instead of `env.HOME`.',
    },
    experimentalDecorators: {
        description: 'A NestJS scope turns `experimentalDecorators` on.',
        why: 'NestJS builds its modules and controllers with these decorators.',
        fix: 'Set `"experimentalDecorators": true` under `compilerOptions`.',
        example: 'A NestJS tsconfig without the option reports `experimentalDecorators`.',
    },
    emitDecoratorMetadata: {
        description: 'A NestJS scope turns `emitDecoratorMetadata` on.',
        why: 'NestJS reads the emitted type metadata to inject the dependencies of each class.',
        fix: 'Set `"emitDecoratorMetadata": true` under `compilerOptions`.',
        example: 'A NestJS tsconfig without the option reports `emitDecoratorMetadata`.',
    },
    alwaysStrict: {
        description: '`alwaysStrict` stays on under `strict`.',
        why: 'It parses each file in strict mode, which turns silent mistakes into errors.',
        fix: 'Remove `"alwaysStrict": false` from `compilerOptions`.',
        example: '`"strict": true` with `"alwaysStrict": false` reports `alwaysStrict`.',
    },
    noImplicitAny: {
        description: '`noImplicitAny` stays on under `strict`.',
        why: 'Without it, a value without a type becomes `any`, which skips every type check.',
        fix: 'Remove `"noImplicitAny": false` from `compilerOptions`.',
        example: '`"strict": true` with `"noImplicitAny": false` reports `noImplicitAny`.',
    },
    noImplicitThis: {
        description: '`noImplicitThis` stays on under `strict`.',
        why: 'Without it, a `this` without a type becomes `any`, so a call on the wrong object passes.',
        fix: 'Remove `"noImplicitThis": false` from `compilerOptions`.',
        example: '`"strict": true` with `"noImplicitThis": false` reports `noImplicitThis`.',
    },
    strictBindCallApply: {
        description: '`strictBindCallApply` stays on under `strict`.',
        why: 'Without it, calls through `bind`, `call`, and `apply` skip the argument checks.',
        fix: 'Remove `"strictBindCallApply": false` from `compilerOptions`.',
        example: '`"strict": true` with `"strictBindCallApply": false` reports `strictBindCallApply`.',
    },
    strictBuiltinIteratorReturn: {
        description: '`strictBuiltinIteratorReturn` stays on under `strict`.',
        why: 'Without it, the final result of a built-in iterator has the type `any`.',
        fix: 'Remove `"strictBuiltinIteratorReturn": false` from `compilerOptions`.',
        example: '`"strict": true` with `"strictBuiltinIteratorReturn": false` reports `strictBuiltinIteratorReturn`.',
    },
    strictFunctionTypes: {
        description: '`strictFunctionTypes` stays on under `strict`.',
        why: 'Without it, function parameters compare loosely, so a callback can receive a value that it cannot handle.',
        fix: 'Remove `"strictFunctionTypes": false` from `compilerOptions`.',
        example: '`"strict": true` with `"strictFunctionTypes": false` reports `strictFunctionTypes`.',
    },
    strictNullChecks: {
        description: '`strictNullChecks` stays on under `strict`.',
        why: 'Without it, `null` and `undefined` fit every type, so a missing value reaches code that does not expect it.',
        fix: 'Remove `"strictNullChecks": false` from `compilerOptions`.',
        example: '`"strict": true` with `"strictNullChecks": false` reports `strictNullChecks`.',
    },
    strictPropertyInitialization: {
        description: '`strictPropertyInitialization` stays on under `strict`.',
        why: 'Without it, a class property can stay unset after the constructor.',
        fix: 'Remove `"strictPropertyInitialization": false` from `compilerOptions`.',
        example:
            '`"strict": true` with `"strictPropertyInitialization": false` reports `strictPropertyInitialization`.',
    },
    useUnknownInCatchVariables: {
        description: '`useUnknownInCatchVariables` stays on under `strict`.',
        why: 'Without it, a caught error has the type `any` instead of `unknown`.',
        fix: 'Remove `"useUnknownInCatchVariables": false` from `compilerOptions`.',
        example: '`"strict": true` with `"useUnknownInCatchVariables": false` reports `useUnknownInCatchVariables`.',
    },
} as const satisfies Readonly<
    Record<
        | typeof MISSING_TSCONFIG_RULE
        | typeof UNREADABLE_TSCONFIG_RULE
        | keyof typeof COMPILER_OPTIONS
        | keyof typeof NESTJS_COMPILER_OPTIONS
        | (typeof STRICT_FAMILY_OPTIONS)[number],
        RuleExplanation
    >
>;
