export type Mount = { path: string; source: string; target: string; text: string };

export type NginxMounts = { configs: Pick<Mount, 'source' | 'target'>[]; certificate: string; key: string };
