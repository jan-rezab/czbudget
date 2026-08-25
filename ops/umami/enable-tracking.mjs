#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteId = process.argv[2];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!websiteId || !uuidPattern.test(websiteId)) {
  console.error('Usage: node ops/umami/enable-tracking.mjs <umami-website-uuid>');
  process.exit(1);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const nginxPath = resolve(scriptDir, '..', '..', 'nginx.conf.template');
const analyticsOrigin = 'https://analytics.publicspendingdata.org';
const tracker = `<script defer src="${analyticsOrigin}/script.js" data-website-id="${websiteId}" data-domains="publicspendingdata.org,www.publicspendingdata.org" data-do-not-track="true" data-exclude-search="true" data-performance="true"></script>`;
const headMarker = "sub_filter '<head>' '<head>";

let config = await readFile(nginxPath, 'utf8');

if (config.includes('data-website-id=')) {
  config = config.replace(
    /data-website-id="[0-9a-f-]+"/i,
    `data-website-id="${websiteId}"`,
  );
} else {
  if (!config.includes(headMarker)) {
    throw new Error(`Could not find the global <head> injection in ${nginxPath}`);
  }
  config = config.replace(headMarker, `${headMarker}${tracker}`);
}

config = config.replace(
  "connect-src 'self';",
  `connect-src 'self' ${analyticsOrigin};`,
);
config = config.replace(
  "script-src 'self' 'unsafe-inline';",
  `script-src 'self' 'unsafe-inline' ${analyticsOrigin};`,
);

await writeFile(nginxPath, config);
console.log(`Enabled privacy-preserving Umami tracking for website ${websiteId}.`);
console.log(`Updated ${nginxPath}`);
