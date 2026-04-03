#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 目标版本号
const targetVersion = process.argv[2];

// 验证版本号格式（0.x.x 或 0.x.x-pre 等）
if (!targetVersion || !/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(targetVersion)) {
  console.error(
    '❌ 无效的版本号格式\n' +
    '用法: npm run set-version <version>\n' +
    '示例: npm run set-version 0.3.0\n' +
    '      npm run set-version 0.3.0-beta.1'
  );
  process.exit(1);
}

const rootDir = path.join(__dirname, '..');

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

console.log(`📝 开始更新版本号到: ${targetVersion}\n`);

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
