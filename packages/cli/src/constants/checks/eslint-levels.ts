import { z } from 'zod';
import ruleLevels from './eslint-levels.json' with { type: 'json' };

/** Stable rule membership for generated defaults and required-rule validation. */
export const ESLINT_RULE_LEVELS = z.record(z.string(), z.enum(['recommended', 'all'])).parse(ruleLevels);
