import { z } from 'zod';

export const messagesSchema = z.record(z.string(), z.unknown());
