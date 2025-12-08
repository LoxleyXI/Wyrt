#!/usr/bin/env node
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const modulesDir = 'modules';

// Collect all module paths - supports both flat and nested category structures
const modulePaths = [];

const topLevelDirs = readdirSync(modulesDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory());

for (const dir of topLevelDirs) {
  const dirPath = join(modulesDir, dir.name);
  const packageJsonPath = join(dirPath, 'package.json');
  const testsPath = join(dirPath, 'tests');

  if (existsSync(packageJsonPath) && existsSync(testsPath)) {
    // Flat structure with tests
    modulePaths.push({ name: dir.name, path: dirPath });
  } else if (dir.name.startsWith('wyrt_')) {
    // Category directory - scan for modules inside
    const categoryDirs = readdirSync(dirPath, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const subDir of categoryDirs) {
      const subPath = join(dirPath, subDir.name);
      const subTestsPath = join(subPath, 'tests');

      if (existsSync(subTestsPath)) {
        modulePaths.push({ name: subDir.name, path: subPath });
      }
    }
  }
}

console.log(`Found ${modulePaths.length} modules with tests: ${modulePaths.map(m => m.name).join(', ')}\n`);

let failed = 0;
for (const module of modulePaths) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${module.name}...`);
  console.log('='.repeat(60));

  const result = spawnSync('npm', ['test'], {
    cwd: module.path,
    stdio: 'inherit',
    shell: true
  });

  if (result.status !== 0) {
    failed++;
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Test Summary: ${modulePaths.length - failed}/${modulePaths.length} modules passed`);
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
