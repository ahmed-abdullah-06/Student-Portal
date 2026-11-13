import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { en, ur } from './index.jsx';
import { extractHardcodedStrings, extractRoutePaths } from './extractHardcodedStrings.js';

const sourceRoot = path.resolve(__dirname, '..');

describe('translation catalogue coverage', () => {
  it('keeps English and Urdu catalogues key-complete', () => {
    expect(Object.keys(ur).sort()).toEqual(Object.keys(en).sort());
  });

  it('does not leave catalogue values empty or key-shaped', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value, `${key} has no English translation`).toEqual(expect.any(String));
      expect(value.trim(), `${key} has an empty English translation`).not.toBe('');
    }
    for (const [key, value] of Object.entries(ur)) {
      expect(value, `${key} has no Urdu translation`).toEqual(expect.any(String));
      expect(value.trim(), `${key} has an empty Urdu translation`).not.toBe('');
    }
  });

  it('keeps every literal t() call backed by both catalogues', () => {
    const files = [];
    const visit = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) visit(full);
      else if (/\.(jsx|js)$/.test(entry.name) && !entry.name.endsWith('.test.jsx')) files.push(full);
    });
    visit(sourceRoot);
    const keys = new Set();
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\bt\(\s*['"`]([^'"`]+)['"`]/g)) keys.add(match[1]);
    }
    const missing = [...keys].filter((key) => !(key in en) || !(key in ur));
    expect(missing, `Missing translation keys: ${missing.join(', ')}`).toEqual([]);
  });

  it('extracts visible JSX literals deterministically for the translation audit', () => {
    const source = '<h1>Dashboard</h1><button aria-label="Save">Save</button><div>{name}</div>';
    expect(extractHardcodedStrings(source)).toEqual(['Dashboard', 'Save']);
    expect(extractHardcodedStrings(source)).toEqual(extractHardcodedStrings(source));
  });

  it('covers the complete application route inventory', () => {
    const app = fs.readFileSync(path.resolve(sourceRoot, 'App.jsx'), 'utf8');
    const routes = extractRoutePaths(app);
    expect(routes.length).toBeGreaterThanOrEqual(40);
    expect(routes).toEqual([...routes].sort());
    expect(routes).toContain('/student');
    expect(routes).toContain('/faculty');
    expect(routes).toContain('/admin');
    expect(routes).toContain('/platform');
  });
});
