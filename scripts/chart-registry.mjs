import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
export const registry=JSON.parse(readFileSync(resolve(root,'chart-components.json'),'utf8'));

export function matchPath(pattern,file) {
  const escaped=pattern.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replaceAll('**','\u0000').replaceAll('*','[^/]*').replaceAll('\u0000','.*');
  return new RegExp(`^${escaped}$`).test(file);
}
export function consumerTests(file) {
  const tests=new Set();
  for(const consumer of registry.consumers) if(consumer.change_paths.some(pattern=>matchPath(pattern,file))) consumer.tests.forEach(test=>tests.add(test));
  return [...tests];
}
export function sharedPath(file) {
  return registry.verification.shared_paths.some(pattern=>matchPath(pattern,file));
}
