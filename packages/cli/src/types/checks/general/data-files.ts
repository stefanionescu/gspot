import type { CST } from 'yaml';

export type YamlFinding = { offset: number; rule: string; message: string };

export type YamlAnchorToken = Pick<CST.SourceToken, 'offset' | 'source'>;
