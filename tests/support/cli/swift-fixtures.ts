// The planted Swift sources of the swift configuration tests and the init arguments they start from.
import { initArgs } from '#tests/support/cli/init.ts';

/** init selecting swift and naming without spelling. */
export const SWIFT_INIT = initArgs(['swift', 'naming'], ['spelling']);
