import * as vscode from 'vscode';

/** GlueKit 在仓库内约定的单条 Rule 路径（自然语言规则，由 Qoder 按产品能力解析与生效） */
export const GLUEKIT_QODER_RULE_REL = '.qoder/rules/gluekit-conversation-journal.md';

/** 半自动「记录本轮要点」：把剪贴板内容追加到此文件（扩展无法直接读取 IDE 对话面板） */
export const GLUEKIT_QODER_ROUND_NOTES_REL = '.qoder/logs/gluekit-round-notes.md';

const RULE_BODY = `# GlueKit：对话留痕约定（项目规则）

本文件由 **GlueKit 工作台 → .qoder 资源** 一键生成，可在 Qoder 中将本规则配置为**按需引用**、**由模型判断**或**始终应用**等策略（以 Qoder 当前产品为准）。

## 期望行为

当用户要求**记录本轮讨论**、**写入会话摘要**，或团队约定的触发条件满足时，请将本轮要点**追加**到仓库文件：

- 路径：\`.qoder/logs/gluekit-session-log.md\`
- 若 \`.qoder/logs/\` 不存在，请先创建再写入。

每条记录建议包含：

1. **时间**：ISO 8601 或等价可读时间戳  
2. **用户侧**：问题或任务摘要（数句即可，勿全文粘贴敏感正文除非用户明确要求）  
3. **助手侧**：结论、决策、待办与未决问题（数句即可）

## 禁止

- 勿写入密钥、令牌、Cookie、未脱敏的个人信息或客户机密。  
- 勿覆盖上述日志文件的全部历史内容，应**仅在文末追加**。

## 说明

GlueKit 扩展**不能**自动读取 IDE 内对话面板的原文；全量留痕依赖 Qoder 对本规则的执行。若需**人工剪贴**备份，请使用 GlueKit 同页的 **「记录本轮要点（剪贴板）」**，将已复制内容追加到 \`${GLUEKIT_QODER_ROUND_NOTES_REL}\`。
`;

function rootFolder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function mkdirpForFile(workspaceRoot: vscode.Uri, rel: string): Promise<void> {
  const segments = rel.split('/').filter(Boolean);
  let cur = workspaceRoot;
  for (let i = 0; i < segments.length - 1; i++) {
    cur = vscode.Uri.joinPath(cur, segments[i]);
    try {
      await vscode.workspace.fs.createDirectory(cur);
    } catch {
      /* 已存在 */
    }
  }
}

function assertSafeQoderRel(rel: string): void {
  const n = rel.replace(/\\/g, '/');
  if (!n || n.includes('..') || !n.startsWith('.qoder/')) {
    throw new Error('路径无效');
  }
}

export interface QoderKitOpResult {
  ok: boolean;
  message: string;
  path?: string;
}

/** 若不存在则创建一条 Rule；不覆盖已有文件 */
export async function ensureGluekitQoderRule(): Promise<QoderKitOpResult> {
  const folder = rootFolder();
  if (!folder) {
    return { ok: false, message: '未打开工作区。' };
  }
  assertSafeQoderRel(GLUEKIT_QODER_RULE_REL);
  const uri = vscode.Uri.joinPath(folder.uri, ...GLUEKIT_QODER_RULE_REL.split('/'));
  if (await exists(uri)) {
    return { ok: true, message: '规则文件已存在，未覆盖。', path: GLUEKIT_QODER_RULE_REL };
  }
  await mkdirpForFile(folder.uri, GLUEKIT_QODER_RULE_REL);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(RULE_BODY, 'utf8'));
  return { ok: true, message: '已创建 GlueKit 对话留痕规则。', path: GLUEKIT_QODER_RULE_REL };
}

/** 将剪贴板文本追加到 gluekit-round-notes.md（无法从扩展读取对话面板时，由用户先复制再点按钮） */
export async function appendRoundNotesFromClipboard(): Promise<QoderKitOpResult> {
  const folder = rootFolder();
  if (!folder) {
    return { ok: false, message: '未打开工作区。' };
  }
  assertSafeQoderRel(GLUEKIT_QODER_ROUND_NOTES_REL);
  const text = (await vscode.env.clipboard.readText()).trim();
  if (!text) {
    return {
      ok: false,
      message: '剪贴板为空。请先在对话中选中并复制「你的提问与助手回复」后再点此按钮。',
    };
  }
  const uri = vscode.Uri.joinPath(folder.uri, ...GLUEKIT_QODER_ROUND_NOTES_REL.split('/'));
  await mkdirpForFile(folder.uri, GLUEKIT_QODER_ROUND_NOTES_REL);
  let prev = '';
  if (await exists(uri)) {
    const buf = await vscode.workspace.fs.readFile(uri);
    prev = Buffer.from(buf).toString('utf8');
  }
  const stamp = new Date().toISOString();
  const block = `\n\n---\n**记录时间（GlueKit 追加）**：${stamp}\n\n${text}\n`;
  const next = (prev ? prev : `# GlueKit：半自动要点剪贴\n\n（由「记录本轮要点（剪贴板）」追加；扩展无法直接读取对话面板原文。）\n`) + block;
  await vscode.workspace.fs.writeFile(uri, Buffer.from(next, 'utf8'));
  return { ok: true, message: '已追加到 .qoder/logs/gluekit-round-notes.md', path: GLUEKIT_QODER_ROUND_NOTES_REL };
}
