// Validates every JSON file in src/templates/ (mirrors validateTemplate in src/lib/templates.ts).
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'templates');
const ENTER = ['none', 'fade', 'pop', 'slam', 'zoom', 'slideUp', 'slideDown', 'blur', 'drop', 'spin', 'glitch', 'typewriter', 'flyIn', 'flip', 'stretch', 'swing'];
const EXIT = ['none', 'fade', 'blur', 'slideUp', 'shrink', 'scatter', 'fall', 'pop'];
const PLACEMENTS = ['block', 'scatter', 'stairs', 'zigzag', 'orbit', 'wander', 'bounce'];
const EASINGS = ['linear', 'easeOut', 'easeInOut', 'back', 'elastic', 'bounce'];

function validate(o) {
  const e = [];
  if (!o.id || !/^[a-z0-9-]+$/.test(o.id)) e.push('id: lowercase letters, digits and dashes only');
  if (!o.name) e.push('name is required');
  if (!o.vibe) e.push('vibe is required');
  if (!o.font?.family) e.push('font.family is required');
  if (typeof o.font?.weight !== 'number') e.push('font.weight must be a number');
  if (typeof o.font?.size !== 'number' || o.font.size < 20 || o.font.size > 400) e.push('font.size must be 20–400');
  if (!o.color?.fill) e.push('color.fill is required');
  if (!['line', 'chunk', 'word'].includes(o.layout?.mode)) e.push('layout.mode must be line | chunk | word');
  if (!['upper', 'center', 'lower'].includes(o.layout?.anchor)) e.push('layout.anchor must be upper | center | lower');
  if (!['all', 'word', 'char'].includes(o.reveal)) e.push('reveal must be all | word | char');
  if (!ENTER.includes(o.enter?.anim)) e.push(`enter.anim must be one of ${ENTER.join(', ')}`);
  if (o.enter?.easing && !EASINGS.includes(o.enter.easing)) e.push(`enter.easing must be one of ${EASINGS.join(', ')}`);
  if (!EXIT.includes(o.exit?.anim)) e.push(`exit.anim must be one of ${EXIT.join(', ')}`);
  if (o.active && !['none', 'color', 'sung', 'box', 'underline'].includes(o.active.mode)) {
    e.push('active.mode must be none | color | sung | box | underline');
  }
  if (o.color?.blend && !['normal', 'multiply', 'screen', 'overlay', 'difference', 'soft-light'].includes(o.color.blend)) {
    e.push('color.blend must be normal | multiply | screen | overlay | difference | soft-light');
  }
  if (o.emphasis && !['lineEnd', 'marked', 'none'].includes(o.emphasis.trigger)) e.push('emphasis.trigger must be lineEnd | marked | none');
  if (o.layout?.placement && !PLACEMENTS.includes(o.layout.placement)) e.push(`layout.placement must be one of ${PLACEMENTS.join(', ')}`);
  return e;
}

let failed = 0;
const ids = new Set();
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  let errs;
  try {
    const t = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    errs = validate(t);
    if (t.id && `${t.id}.json` !== f) errs.push(`id "${t.id}" should match the file name`);
    if (ids.has(t.id)) errs.push(`duplicate id "${t.id}"`);
    ids.add(t.id);
  } catch (err) {
    errs = [`invalid JSON: ${err.message}`];
  }
  if (errs.length) {
    failed++;
    console.log(`✗ ${f}\n  - ${errs.join('\n  - ')}`);
  } else console.log(`✓ ${f}`);
}
if (failed) {
  console.log(`\n${failed} template(s) have problems.`);
  process.exit(1);
}
