---
description: 对改动内容执行git提交
model: GLM-5.0
---

对你的改动内容执行 git 提交（仅本地提交，不推送）。

**要求**

1. 用 `git status` 查看所有变更，甄别哪些文件属于本次修改意图：
   - 通过 `git diff` 分析各文件的具体改动
   - 将无关文件排除在本次提交之外
2. 确认提交范围后再执行 `git add`（仅添加相关文件）
3. 生成符合 Conventional Commits 规范的提交信息：
   - 格式：`<type>(<scope>): <description>`
   - 类型：feat/fix/docs/style/refactor/test/chore
   - 使用中文描述，简洁明确（不超过 200 字符）
4. 执行 `git commit`，不执行 `git push`
5. 输出提交结果摘要（类型、涉及文件数、提交哈希前 7 位）

**注意**

- 如果存在多个不相关的改动，提示用户是否需要分多次提交
- 不要将无关的配置文件、临时文件等一并提交