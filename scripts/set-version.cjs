#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rootDir = path.join(__dirname, '..');

// 读取当前版本号
function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  return pkg.version;
}

// Semver 比较器（仅比较数字部分，预发布标签按字母序）
function compareSemver(a, b) {
  const parseVersion = (v) => {
    const match = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
    if (!match) return null;
    return { major: +match[1], minor: +match[2], patch: +match[3], pre: match[4] || null };
  };
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return 0;
  for (const key of ['major', 'minor', 'patch']) {
    if (va[key] !== vb[key]) return va[key] - vb[key];
  }
  if (va.pre && !vb.pre) return -1;
  if (!va.pre && vb.pre) return 1;
  if (va.pre && vb.pre) return va.pre.localeCompare(vb.pre);
  return 0;
}

// 根据当前版本生成推荐版本
function suggestVersions(current) {
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) return [];
  const [, major, minor, patch, pre] = match;
  const M = +major, m = +minor, p = +patch;
  const suggestions = [];

  if (pre) {
    suggestions.push({ version: `${M}.${m}.${p}`, label: '正式版' });
    suggestions.push({ version: `${M}.${m}.${p}-${incrementPre(pre)}`, label: '预发布递增' });
  }
  suggestions.push({ version: `${M}.${m}.${p + 1}`, label: 'patch' });
  suggestions.push({ version: `${M}.${m + 1}.0`, label: 'minor' });
  suggestions.push({ version: `${M + 1}.0.0`, label: 'major' });

  return suggestions;
}

function incrementPre(pre) {
  const match = pre.match(/^(.+?)(?:\.(\d+))?$/);
  if (!match) return pre + '.1';
  const [, prefix, num] = match;
  if (num !== undefined) return `${prefix}.${+num + 1}`;
  return `${prefix}.1`;
}

// 需要修改的文件列表
function getFilesToUpdate(targetVersion) {
  return [
    {
      path: path.join(rootDir, 'package.json'),
      updateFn: (content) => {
        const obj = JSON.parse(content);
        obj.version = targetVersion;
        return JSON.stringify(obj, null, 2) + '\n';
      }
    },
    {
      path: path.join(rootDir, 'src-tauri', 'Cargo.toml'),
      updateFn: (content) => {
        return content.replace(
          /^(version = ")[\d.]+([-a-zA-Z0-9.]*)"$/m,
          `$1${targetVersion}$2"`
        );
      }
    },
    {
      path: path.join(rootDir, 'src-tauri', 'tauri.conf.json'),
      updateFn: (content) => {
        const obj = JSON.parse(content);
        obj.version = targetVersion;
        return JSON.stringify(obj, null, 2) + '\n';
      }
    }
  ];
}

function applyVersionUpdate(targetVersion) {
  const filesToUpdate = getFilesToUpdate(targetVersion);
  let successCount = 0;
  let failCount = 0;

  console.log(`\n📝 更新版本号: ${currentVersion} → ${targetVersion}\n`);

  filesToUpdate.forEach(({ path: filePath, updateFn }) => {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`❌ 文件不存在: ${filePath}`);
        failCount++;
        return;
      }
      const originalContent = fs.readFileSync(filePath, 'utf-8');
      const newContent = updateFn(originalContent);
      fs.writeFileSync(filePath, newContent, 'utf-8');
      console.log(`✅ 已更新: ${path.relative(rootDir, filePath)}`);
      successCount++;
    } catch (error) {
      console.error(`❌ 更新失败: ${path.relative(rootDir, filePath)}`);
      console.error(`   错误: ${error.message}`);
      failCount++;
    }
  });

  console.log(`\n📊 结果: ${successCount} 个成功, ${failCount} 个失败`);

  if (failCount > 0) {
    process.exit(1);
  }

  console.log(`\n✨ 版本号已成功更新为 ${targetVersion}`);
}

// --- 交互式入口 ---

const currentVersion = getCurrentVersion();
const suggestions = suggestVersions(currentVersion);

console.log(`\n当前版本: ${currentVersion}\n`);
console.log('建议版本:');
suggestions.forEach(({ version, label }, i) => {
  console.log(`  [${i + 1}] ${version.padEnd(16)} (${label})`);
});
console.log();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('请输入版本号（或序号选择建议版本）：', (input) => {
  rl.close();

  const trimmed = input.trim();
  if (!trimmed) {
    console.error('❌ 版本号不能为空');
    process.exit(1);
  }

  // 支持通过序号选择建议版本
  let targetVersion = trimmed;
  const index = parseInt(trimmed, 10);
  if (!isNaN(index) && index >= 1 && index <= suggestions.length) {
    targetVersion = suggestions[index - 1].version;
  }

  // 验证版本号格式
  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(targetVersion)) {
    console.error(`❌ 无效的版本号格式: ${targetVersion}`);
    console.error('格式要求: X.Y.Z 或 X.Y.Z-prerelease（如 0.7.0、0.7.0-beta.1）');
    process.exit(1);
  }

  // 禁止新版本 <= 现有版本
  if (compareSemver(targetVersion, currentVersion) <= 0) {
    console.error(`❌ 新版本 ${targetVersion} 必须大于当前版本 ${currentVersion}`);
    process.exit(1);
  }

  applyVersionUpdate(targetVersion);
});
