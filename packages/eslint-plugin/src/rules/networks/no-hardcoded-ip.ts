import { isIP } from 'node:net';
import { createRule } from '../../rule.ts';
import { OCTAL_RADIX } from '../../config/security.ts';

import {
    IPV4_OCTETS,
    OCTAL_OCTET,
    NETMASK_SUFFIX,
    HEXADECIMAL_RADIX,
    HEXADECIMAL_OCTET,
    MAPPED_IPV4_PREFIX,
    ALLOWED_IP_PREFIXES,
    ALLOWED_IP_ADDRESSES,
} from '../../config/web.ts';

function isReportedAddress(address: string): boolean {
    const isAllowed =
        ALLOWED_IP_ADDRESSES.has(address) ||
        ALLOWED_IP_PREFIXES.some(
            (prefix) => address.startsWith(prefix) || address.startsWith(`${MAPPED_IPV4_PREFIX}${prefix}`),
        );
    return !isAllowed && isIP(address) !== 0;
}

function convertEncodedAddress(address: string): string | undefined {
    const octets = address.split('.');
    const numbers = octets.map((octet) => {
        if (OCTAL_OCTET.test(octet)) return Number.parseInt(octet, OCTAL_RADIX);
        return HEXADECIMAL_OCTET.test(octet) ? Number.parseInt(octet, HEXADECIMAL_RADIX) : Number.NaN;
    });
    return octets.length === IPV4_OCTETS && numbers.every((number) => !Number.isNaN(number))
        ? numbers.join('.')
        : undefined;
}

export const noHardcodedIp = createRule<[], 'hardcoded'>({
    name: 'no-hardcoded-ip',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Finds string literals that hold an IPv4 or IPv6 address, with or without a netmask, also written in octal or hexadecimal octets. Loopback, unspecified, broadcast, and documentation addresses pass.',
            why: 'An address written in the code ties the program to one network, and changing it needs a new release. It can also expose an internal host.',
            fix: 'Read the address from configuration, or use a host name that DNS resolves.',
            example:
                'The literal `"10.0.12.4"` reports `hardcoded`. Read it from configuration, such as `process.env.DATABASE_HOST`.',
        },
        schema: [],
        messages: {
            hardcoded: 'Make sure that the address {{address}} written here is safe. Read it from configuration.',
        },
    },
    create(context) {
        return {
            Literal(node) {
                if (typeof node.value !== 'string') return;
                const address = node.value.replace(NETMASK_SUFFIX, '');
                const encoded = convertEncodedAddress(address);
                if (isReportedAddress(address) || (encoded !== undefined && isReportedAddress(encoded)))
                    context.report({ node, messageId: 'hardcoded', data: { address: node.value } });
            },
        };
    },
});
