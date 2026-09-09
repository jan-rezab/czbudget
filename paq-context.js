// Shared footer loads this only on Czech territory profiles. Heavy data waits for a click.
import {context, language} from './paq.js';
const response = await fetch('/data/paq/links.json');
if (response.ok) {
  const links = await response.json();
  const key = links[location.pathname];
  if (key) {
    const section = document.createElement('section');
    section.id = 'paq-context'; section.className = 'paq-context';
    section.setAttribute('aria-label', 'PAQ Research · DataPAQ');
    const css = document.createElement('link');css.rel='stylesheet';css.href='/paq.css';document.head.append(css);
    const main = document.querySelector('main');
    if (main) {
      main.after(section);
      await context(section,key);
      let lang=language();
      new MutationObserver(()=>{if(language()!==lang){lang=language();context(section,key);}}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    }
  }
}
