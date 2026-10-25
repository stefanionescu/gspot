import type { z } from 'zod';

type IsOptional<Value, Key extends keyof Value> = Pick<Value, Key> extends Required<Pick<Value, Key>> ? false : true;

export type Parsed<Value, Failure = string> = { value: Value } | { error: Failure };

export type Optional<Value> = { [Key in keyof Value]?: Value[Key] | undefined };

export type Defined<Value> = { [Key in keyof Value]: Exclude<Value[Key], undefined> };

export type SchemaShape<Value, Input = never> = {
    [Key in keyof Value]-?: z.ZodType<
        Required<Value>[Key],
        [Input] extends [never] ? unknown : Key extends keyof Input ? Required<Input>[Key] : never
    > &
        (IsOptional<Value, Key> extends true ? { _zod: { optout: 'optional' } } : unknown) &
        ([Input] extends [never]
            ? unknown
            : Key extends keyof Input
              ? IsOptional<Input, Key> extends true
                  ? { _zod: { optin: 'optional' | 'defaulted' } }
                  : unknown
              : unknown);
};

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
