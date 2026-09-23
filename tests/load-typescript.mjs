// Small test-only loader; uses the project's existing TypeScript dependency.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
export default function loadTypescript(overrides = {}) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const modules = new Map();
  function load(name) {
    const file = path.resolve(root, name);
    if (modules.has(file)) return modules.get(file).exports;
    const compiledModule = { exports: {} };
    modules.set(file, compiledModule);
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const requireSource = id => {
      if (id === 'server-only') return {}; // Tests execute exclusively on the server.
      if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
      if (id.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), id + '.ts')));
      throw new Error(`Unsupported test import: ${id}`);
    };
    vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports, require: requireSource, process, fetch, URL, AbortController, setTimeout, clearTimeout, ...overrides }, { filename: file });
    return compiledModule.exports;
  }
  return load;
};
