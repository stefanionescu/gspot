// The types of unit in this package.
import type * as messages from '#cli/policy/messages.ts';

// Every message function accepts a `never` parameter list, so the sample call goes through Reflect.apply.
export type Message = (...arguments_: never[]) => unknown;
export type Exported = (typeof messages)[keyof typeof messages];
