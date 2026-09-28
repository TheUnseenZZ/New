import type { Template } from './types';

const ENTER = ['none', 'fade', 'pop', 'slam', 'zoom', 'slideUp', 'slideDown', 'blur', 'drop', 'spin', 'glitch', 'typewriter'];
const EXIT = ['none', 'fade', 'blur', 'slideUp', 'shrink'];
const EASINGS = ['linear', 'easeOut', 'easeInOut', 'back', 'elastic', 'bounce'];

/** Returns a list of problems; empty means the template is usable. */
export function validateTemplate(t: unknown): string[] {
  const e: string[] = [];
  const o = t as Partial<Template>;
  if (!o || typeof o !== 'object') return ['Template must be a JSON object'];
  if (!o.id || !/^[a-z0-9-]+$/.test(o.id)) e.push('id: lowercase letters, digits and dashes only');
  if (!o.name) e.push('name is required');
  if (!o.font?.family) e.push('font.family is required');
  if (typeof o.font?.weight !== 'number') e.push('font.weight must be a number');
  if (typeof o.font?.size !== 'number' || o.font.size < 20 || o.font.size > 400) e.push('font.size must be 20–400');
  if (!o.color?.fill) e.push('color.fill is required');
  if (!o.layout || !['line', 'chunk', 'word'].includes(o.layout.mode)) e.push('layout.mode must be line | chunk | word');
  if (o.layout && !['upper', 'center', 'lower'].includes(o.layout.anchor)) e.push('layout.anchor must be upper | center | lower');
  if (!o.reveal || !['all', 'word', 'char'].includes(o.reveal)) e.push('reveal must be all | word | char');
  if (!o.enter || !ENTER.includes(o.enter.anim)) e.push(`enter.anim must be one of ${ENTER.join(', ')}`);
  if (o.enter?.easing && !EASINGS.includes(o.enter.easing)) e.push(`enter.easing must be one of ${EASINGS.join(', ')}`);
  if (!o.exit || !EXIT.includes(o.exit.anim)) e.push(`exit.anim must be one of ${EXIT.join(', ')}`);
  if (o.active && !['none', 'color', 'sung', 'box', 'underline'].includes(o.active.mode)) {
    e.push('active.mode must be none | color | sung | box | underline');
  }
  if (o.color?.blend && !['normal', 'multiply', 'screen', 'overlay', 'difference', 'soft-light'].includes(o.color.blend)) {
    e.push('color.blend must be normal | multiply | screen | overlay | difference | soft-light');
  }
  if (o.emphasis && !['lineEnd', 'marked'].includes(o.emphasis.trigger)) e.push('emphasis.trigger must be lineEnd | marked');
  return e;
}

// Hand-picked gallery order; unknown ids (new templates) go last, alphabetically.
const ORDER = [
  'blackout',
  'red-card',
  'statement',
  'solitude',
  'pop-karaoke',
  'highlight-box',
  'karaoke-fill',
  'bounce',
  'punch',
  'sticker-stack',
  'soft-serif',
  'editorial',
  'whisper',
  'diary',
  'glitch',
  'y2k-chrome',
  'pixel-arcade',
  'typewriter',
];
const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);

// Every JSON file in src/templates/ is picked up automatically: drop a file in, it shows up.
const files = import.meta.glob<Template>('../templates/*.json', { eager: true, import: 'default' });

export const BUILT_IN: Template[] = Object.entries(files)
  .filter(([path, t]) => {
    const errs = validateTemplate(t);
    if (errs.length) console.warn(`Skipping template ${path}:`, errs);
    return !errs.length;
  })
  .map(([, t]) => t)
  .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));

const CUSTOM_KEY = 'lyric-studio:custom-templates';

export function loadCustomTemplates(): Template[] {
  try {
    const list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
    return Array.isArray(list) ? list.filter((t) => !validateTemplate(t).length) : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplates(list: Template[]) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked; custom templates just won't persist */
  }
}
