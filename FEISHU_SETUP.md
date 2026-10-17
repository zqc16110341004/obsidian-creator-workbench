# 飞书接入指南

飞书是可选入口。未配置时可先用本地选题；每位使用者都需要自己的应用和多维表格。

## 1. 创建和发布应用

在 [飞书开放平台](https://open.feishu.cn/app) 创建自建应用，取得 App ID 和 App Secret。不要将 Secret 写入普通笔记、聊天或仓库；稍后在 Obsidian 原生密钥库中配置。

读取选题需具备列出数据表、字段和记录的 API 权限。使用 `/wiki/` 链接还需知识库节点读取权限；也可使用原表 `/base/` 链接。以开放平台当前接口权限要求为准，先开通所需读取权限，再创建并发布应用版本。

官方接口：[数据表](https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table/list) · [字段](https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-field/list) · [读取记录](https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/list) · [节点信息](https://open.feishu.cn/document/server-docs/docs/wiki-v2/space-node/get_node)。

## 2. 给应用授予目标表访问权

在你自己的原表中找到添加文档应用/协作者入口，将该应用加入并授予读取权限。应用 API 权限与原表访问权是两项设置，都要完成；高级行列权限和知识库节点限制也可能影响访问。

## 3. 在工作台连接和关联字段

1. 打开「选题库 → 配置飞书连接」。
2. 填入 App ID；在 App Secret 处选择或新建 Obsidian 密钥。
3. 填入自己的完整多维表格链接（支持 `/wiki/` 与 `/base/`）。安装包不预填作者的原表。
4. 点击「读取数据表」，选择选题所在的数据表。
5. 点击「读取字段」并核对对应关系：选题标题→标题列（必选）；参考文案→原文/资料列（可选）；资料链接→来源链接列（可选）。
6. 点击「保存并读取选题」，选择一条开始创作。重复选择同一条会继续原任务。

连接配置只保存密钥名称；实际密钥由 Obsidian 管理。本地任务保留建稿时快照，后续刷新不会覆盖已修改稿件。单次最多读取 5000 条记录；不会自动下载附件或读取链接正文。

## 4. 可选：新增飞书选题

如需从工作台新增到飞书，还需开通 [新增记录接口权限](https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/create)，重新发布应用版本，并给应用原表编辑权限。后台名称与权限粒度可能变化，以接口页面和组织设置为准。

新增时先在本地保存草稿，再预览具体字段，最后由你确认新增。不会回写稿件、排期或进度。写入结果不明时先核实，不要在飞书手工重复新增相同测试记录。

## 常见问题

- 99991672/拒绝访问：检查 API 权限、版本发布、原表协作者和行列限制；新增还需编辑权限。
- 读不到字段：核对选择的数据表；字段改名后重新读取并确认映射。
- 找不到 App Secret：在 Obsidian 密钥库重选该应用的 Secret。不要将 Secret 贴进反馈中。
- 断网/接口失败：上次成功缓存与本地稿件保留，恢复后手动刷新。
