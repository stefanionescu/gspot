import type { z } from 'zod';

type IsOptional<Value, Key extends keyof Value> = Pick<Value, Key> extends Required<Pick<Value, Key>> ? false : true;

export type Parsed<T, E = string> = { value: T } | { error: E };

export type Optional<T> = { [K in keyof T]?: T[K] | undefined };

export type Defined<T> = { [K in keyof T]: Exclude<T[K], undefined> };

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
