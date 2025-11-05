#!/usr/bin/env node
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const modulesDir = 'modules';
const modules = readdirSync(modulesDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name)
  .filter(name => {
    const testsPath = join(modulesDir, name, 'tests');
    return existsSync(testsPath);
  });

console.log(`Found ${modules.length} modules with tests: ${modules.join(', ')}\n`);

let failed = 0;
for (const module of modules) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${module}...`);
  console.log('='.repeat(60));

  const result = spawnSync('npm', ['test'], {
    cwd: join(modulesDir, module),
    stdio: 'inherit',
    shell: true
  });

  if (result.status !== 0) {
    failed++;
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Test Summary: ${modules.length - failed}/${modules.length} modules passed`);
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
