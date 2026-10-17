# 结构

src/ 为离线网页界面与纯业务模块；obsidian-plugin/ 提供 Obsidian ItemView、本地 JSON 持久化、单向 Markdown 查阅副本、附件保存及宿主连接。构建将 ES 模块嵌入 workbench.html，将 CommonJS 宿主模块合为 main.js；插件不依赖本地预览服务。

工作台 JSON 为权威记录，上一版原子备份；附件按内容哈希存于知识库。Markdown 手改保护与更新待合并目录独立。前端 iframe 的 CSP 阻止任意网络请求，远端操作走明确宿主接口。

Codex 为独立本机子进程。文字通道限制工具，不读整个知识库；封面能力单独授权。飞书凭据来自 Obsidian SecretStorage，配置仅存名称与字段映射。视频由 FFmpeg/ffprobe/Python 离线处理；截图由本机 Vision 辅助程序识别。

构建目录 obsidian-dist/ 被忽略，发布脚本按允许清单打 ZIP 并写 SHA256。源码不携带任何用户知识库、工作台数据、运行会话或密钥。
