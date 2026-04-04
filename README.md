# GlueKit Workbench

VS Code / Qoder 侧栏 Webview：**Proposal → Spec → 规约配套 → Tasks** 等 Spec Coding 流程的工作台（扫描、门禁、拆分、Glue / Harness / `.qoder` 等）。

- **许可证**：[MIT](LICENSE)  
- **安全披露**：[SECURITY.md](SECURITY.md)  
- **状态**：适合团队自用与社区试用；能力随版本迭代，见更新日志与 `package.json` 的 `version`。


- **直接使用**：https://marketplace.visualstudio.com/items?itemName=LvZhaobo.gluekit-workbench

## 从 GitHub 克隆后安装（源码 → VSIX）

在仓库根目录若包含本扩展子目录 `gluekit-workbench/`：

```bash
cd gluekit-workbench
npm install
npm run package
```

会在当前目录生成 `gluekit-workbench-<version>.vsix`。

在 **Cursor / VS Code** 中：

1. `Ctrl+Shift+P`（macOS：`Cmd+Shift+P`）→ **Extensions: Install from VSIX…**  
2. 选择生成的 `.vsix` 文件。

或在终端（将路径换成你的 `.vsix` 绝对路径）：

```bash
cursor --install-extension /path/to/gluekit-workbench-0.5.3.vsix --force
# 或
code --install-extension /path/to/gluekit-workbench-0.5.3.vsix --force
```

## 开发调试

```bash
cd gluekit-workbench
npm install
npm run compile
```

用 VS Code 打开 `gluekit-workbench` 目录，**Run and Debug** 启动 “Extension Development Host”，或使用：

```bash
npm run open-dev-host
```

（脚本以当前扩展目录为 `--extensionDevelopmentPath`，上级目录为工作区。）

## 开源与安全说明

- 本扩展**仅在本地工作区**读写文件、执行你确认的模板与命令；**不会**把代码自动上传到 GlueKit 服务器（无此类后端）。  
- 使用 Webview 与 `postMessage` 与宿主通信；请从**可信来源**克隆仓库并自行审查 `src/`。  
- 漏洞报告见 [SECURITY.md](SECURITY.md)；建议在 README 标明 **实验性/版本号**、**Issue 入口**。

## 仓库结构（扩展内）

| 路径 | 说明 |
|------|------|
| `src/` | TypeScript 扩展入口、扫描、消息、工作流 |
| `media/workbench/` | Webview 前端 `workbench.js` / `workbench.css` |
