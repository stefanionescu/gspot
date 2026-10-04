/* eslint-disable gspot/no-trivial-files -- reason: This shared schema validates generated rule snapshots and persisted ownership records. */
import { z } from 'zod';

/** Rule values captured before serialization, grouped by their declared manifest paths. */
export const ruleSettingsSchema = z.record(z.string(), z.record(z.string(), z.json()));
