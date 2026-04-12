#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

// 读取当前版本号
function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  return pkg.version;
}

const currentVersion = getCurrentVersion();

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
  // 有预发布标签 < 无预发布标签（1.0.0-alpha < 1.0.0）
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
    // 有预发布标签：建议去掉标签的正式版 + 预发布递增
    suggestions.push({ version: `${M}.${m}.${p}`, label: '正式版' });
    suggestions.push({ version: `${M}.${m}.${p}-${incrementPre(pre)}`, label: '预发布递增' });
  }
  // patch 递增
  suggestions.push({ version: `${M}.${m}.${p + 1}`, label: 'patch' });
  // minor 递增
  suggestions.push({ version: `${M}.${m + 1}.0`, label: 'minor' });
  // major 递增
  suggestions.push({ version: `${M + 1}.0.0`, label: 'major' });

  return suggestions;
}

function incrementPre(pre) {
  // 尝试递增预发布编号（如 beta.1 → beta.2），否则追加 .1
  const match = pre.match(/^(.+?)(?:\.(\d+))?$/);
  if (!match) return pre + '.1';
  const [, prefix, num] = match;
  if (num !== undefined) return `${prefix}.${+num + 1}`;
  return `${prefix}.1`;
}

// 目标版本号
const targetVersion = process.argv[2];

// 验证版本号格式（0.x.x 或 0.x.x-pre 等）
if (!targetVersion || !/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(targetVersion)) {
  const suggestions = suggestVersions(currentVersion);
  let msg =
    `当前版本: ${currentVersion}\n\n` +
    '❌ 无效的版本号格式\n' +
    '用法: npm run set-version <version>\n' +
    '示例: npm run set-version 0.3.0\n' +
    '      npm run set-version 0.3.0-beta.1\n\n' +
    '推荐版本:\n';
  suggestions.forEach(({ version, label }) => {
    msg += `  ${version.padEnd(16)} (${label})\n`;
  });
  console.error(msg);
  process.exit(1);
}

// 禁止新版本 <= 现有版本
const cmp = compareSemver(targetVersion, currentVersion);
if (cmp <= 0) {
  console.error(
    `❌ 新版本 ${targetVersion} 必须大于当前版本 ${currentVersion}\n` +
    '请指定一个更高的版本号。'
  );
  process.exit(1);
}

// 需要修改的文件列表
const filesToUpdate = [
  {
    path: path.join(rootDir, 'package.json'),
    type: 'json',
    updateFn: (content) => {
      const obj = JSON.parse(content);
      obj.version = targetVersion;
      return JSON.stringify(obj, null, 2) + '\n';
    }
  },
  {
    path: path.join(rootDir, 'src-tauri', 'Cargo.toml'),
    type: 'toml',
    updateFn: (content) => {
      return content.replace(
        /^(version = ")[\d.]+([-a-zA-Z0-9.]*)"$/m,
        `$1${targetVersion}$2"`
      );
    }
  },
  {
    path: path.join(rootDir, 'src-tauri', 'tauri.conf.json'),
    type: 'json',
    updateFn: (content) => {
      const obj = JSON.parse(content);
      obj.version = targetVersion;
      return JSON.stringify(obj, null, 2) + '\n';
    }
  }
];

let successCount = 0;
let failCount = 0;

console.log(`📝 当前版本: ${currentVersion}`);
console.log(`📝 更新版本号到: ${targetVersion}\n`);

filesToUpdate.forEach(({ path: filePath, type, updateFn }) => {
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
