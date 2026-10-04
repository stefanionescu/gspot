/** Selection inputs needed to repeat a finding against the same content. */
import type { PushInput } from '#cli/types/repository/revisions.ts';

export type ReproduceOptions = {
    push?: PushInput;
    messageFile?: string;
    staged?: boolean;
};
