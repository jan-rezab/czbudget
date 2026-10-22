// An HTML attribute starts after whitespace. A word boundary also matches the
// suffix of data-website-id, which nginx's analytics injection adds to the page.
export const htmlIds = html => [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
export const sectionIds = html => [...html.matchAll(/<section\b[^>]*\sid="([^"]+)"/g)].map(match => match[1]);
