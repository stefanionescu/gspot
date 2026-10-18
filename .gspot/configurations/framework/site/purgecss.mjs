export const defaultExtractor = (content) => (content.match(/[\w/:-]+/gu) ?? []).map((token) => { let end = token.length; while (end > 0 && token[end - 1] === ":") end--; return token.slice(0, end); }).filter((token) => token !== '');
export const safelist = { standard: [/^:[\w-]+$/u] };
