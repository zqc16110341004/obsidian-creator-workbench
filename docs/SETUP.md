# 可选功能与环境

## AI 文字共创与图像生成

先在本机安装并登录 Codex，使用 ChatGPT 登录方式，并确认可从本机启动 `codex app-server`。插件会查找应用内的常见位置、Homebrew、`/usr/local/bin` 和进程 PATH；若自动发现失败，可通过启动 Obsidian 时的环境变量 `CREATOR_WORKBENCH_CODEX` 指定可执行程序的绝对路径。仅修改 PATH 后可能需要完全退出并重开 Obsidian。

连接依赖 Codex 的本机协议及当前订阅能力，已在开发机器验证，不能保证任意版本均兼容。安装后先在共创区检查连接；失败时仍可手动写作。插件不代替你登录，不读取密码，不切换到 API Key 计费。

文字共创不执行命令、浏览网页或读取整个知识库。封面生成需要在工作台独立设置中启用图像工具；仅图像子进程启用相应能力，不修改全局 Codex 配置。图像能力可能受账户、额度及协议版本影响；也可以直接导入自己的封面。

## 视频导入与离线转写

- 支持 100 MB 以内、10 分钟以内的 MP4/MOV/WebM；需要本机 `ffprobe` 检查媒体信息。
- 音轨提取需要 `ffmpeg`，转写需要 Python 3、`faster-whisper` 和预先缓存的 `small` 模型。插件不包含或自动安装这些工具，不在转写时下载模型。
- 已验证的开发环境是 Python 3.11 + faster-whisper 1.2.1，CPU int8；其他组合需要自行验证。
- 有多个 Python 时，确认依赖装在插件选中的同一个解释器。可通过 `CREATOR_WORKBENCH_PYTHON3` 指定绝对路径；FFmpeg 对应 `CREATOR_WORKBENCH_FFMPEG` 和 `CREATOR_WORKBENCH_FFPROBE`。
- 环境变量需由启动 Obsidian 的进程继承；不熟悉命令行可先使用手工文字和主线写稿。

先参阅 [FFmpeg](https://ffmpeg.org/download.html) 与 [faster-whisper 官方说明](https://github.com/SYSTRAN/faster-whisper)。在自己选定的 Python 环境中安装依赖并预缓存模型；准备阶段会下载软件与模型，正常离线转写阶段不上传音视频。

```sh
python3 -m pip install 'faster-whisper==1.2.1'
python3 -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"
```

完成后，插件转写程序会使用 `local_files_only=True` 读取本机缓存。转写失败时原记录保留，已导入的视频可补充人工文字继续拆解；若缺少 ffprobe，需要先安装 FFmpeg 才能导入新视频。

## 截图识别

当前发行包的 `recognize-macos` 基于 Apple Vision，随 macOS arm64 包提供，只在本机读取图片。识别结果是候选，不代替人工核对；无可用识别程序时可手动填写指标。不要自行关闭系统安全防护；可从源码使用 Apple Swift 编译对应辅助程序。

## 公开动态与费用

公开博主动态需自行配置可用数据服务、密钥名称、服务价格与月度预算；示例不等于实际采集。未配置不会自动购买服务。模型订阅、服务商和其他独立软件的费用/许可由各自账户决定。
