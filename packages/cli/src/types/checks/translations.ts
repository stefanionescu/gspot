import type { MessageFormatElement } from '@formatjs/icu-messageformat-parser';

export type MessageFiles = { folder: string; base: string; paths: ReadonlySet<string> };

export type ParsedMessage = { elements: MessageFormatElement[] | undefined; error: string | undefined };
