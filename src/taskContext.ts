import * as path from 'path';
import * as vscode from 'vscode';

/** tasks.md 中一条可勾选任务（GlueKit 拆分子卡片） */
export interface TaskItem {
  /** 展示用 ID，如 T1 或行号 */
  id: string;
  title: string;
  lineNo: number;
  raw: string;
  /** 行内匹配的验收标准编号，如 AC-1、AC-2.1 */
  acRefs: string[];
  /** 行内匹配的测试用例 ID，如 TC-FUND-001 */
  tcRefs: string[];
}

/** 从任务描述文本中提取 AC-x / TC-x 引用（用于追溯矩阵与 Tasks 子卡片展示） */
export function extractAcTcFromTaskText(text: string): { acRefs: string[]; tcRefs: string[] } {
  const acRaw = [...text.matchAll(/\bAC-\d+(?:\.\d+)?\b/gi)].map((x) => x[0].toUpperCase());
  const tcRaw = [...text.matchAll(/\bTC-[A-Za-z0-9_.-]+\b/g)].map((x) => x[0]);
  const acRefs = [...new Set(acRaw)];
  const tcRefs = [...new Set(tcRaw)];
  return { acRefs, tcRefs };
}

/**
 * 解析 tasks.md 中的 Markdown 任务行：`- [ ]` / `- [x]`。
 * 支持行尾 `<!-- gk:run:... -->`（展示时去掉注释）。
 * 识别描述中的 **AC-1**、**TC-XXX** 等字样，写入 acRefs / tcRefs。
 */
export function parseTasksMdItems(text: string): TaskItem[] {
  const lines = text.split(/\r?\n/);
  const out: TaskItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*-\s*\[[ xX]\]\s*(.+)$/);
    if (!m) {
      continue;
    }
    let rest = m[1].replace(/<!--[\s\S]*?-->/g, '').trim();
    const idM = rest.match(/^\*\*([^*]+)\*\*/);
    const id = idM ? idM[1].trim() : `L${i + 1}`;
    const title = idM ? rest.slice(idM[0].length).trim() : rest;
    const titleForTrace = title || id;
    const { acRefs, tcRefs } = extractAcTcFromTaskText(titleForTrace);
    out.push({
      id,
      title: titleForTrace,
      lineNo: i + 1,
      raw: line.trim(),
      acRefs,
      tcRefs,
    });
  }
  return out;
}

function normRel(p: string): string {
  return p.replace(/\\/g, '/');
}

/** 与 tasks.md 同目录下的拆分文件（若路径在扫描结果中则视为存在） */
export function siblingKrioMarkdown(tasksMdPath: string, basename: string): string {
  const dir = path.posix.dirname(normRel(tasksMdPath));
  return dir === '.' || dir === '' ? basename : `${dir}/${basename}`;
}

export interface FillSplitTaskOptions {
  mode: 'chat' | 'quest';
  specPath: string;
  tasksMdPath: string;
  taskLineNo: number;
}

function assertSafeRel(rel: string): void {
  const n = normRel(rel);
  if (!n || n.includes('..')) {
    throw new Error('路径无效');
  }
}

async function readUtf8(rel: string): Promise<string | undefined> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    return undefined;
  }
  assertSafeRel(rel);
  const uri = vscode.Uri.joinPath(root, ...rel.split('/').filter(Boolean));
  try {
    const buf = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(buf).toString('utf8');
  } catch {
    return undefined;
  }
}

/** 尝试打开 Qoder Quest / 任务侧栏（命令 ID 因版本而异，失败则忽略） */
export async function tryOpenQoderQuestPanel(): Promise<boolean> {
  const candidates = [
    'qoder.quest.open',
    'qoder.quest.focus',
    'qoder.quest.new',
    'qoder.showQuest',
    'aicoding.quest.open',
    'workbench.view.extension.qoder',
  ];
  for (const cmd of candidates) {
    try {
      await vscode.commands.executeCommand(cmd);
      return true;
    } catch {
      /* 下一候选 */
    }
  }
  return false;
}

function buildPromptBody(
  specPath: string,
  tasksMdPath: string,
  requirementPath: string | undefined,
  designPath: string | undefined,
  task: TaskItem
): string {
  const reqRow = requirementPath
    ? `| 需求摘录（来自 Spec 的拆分） | \`${requirementPath}\` |\n`
    : '';
  const desRow = designPath ? `| 设计摘录 | \`${designPath}\` |\n` : '';
  const traceBlock =
    task.acRefs.length || task.tcRefs.length
      ? `### 追溯（任务行内 AC/TC）\n\n${task.acRefs.length ? `- **覆盖 AC**：${task.acRefs.join('、')}\n` : ''}${task.tcRefs.length ? `- **对应用例 TC**：${task.tcRefs.join('、')}\n` : ''}\n`
      : '';
  return `## GlueKit：执行拆分任务（单条）

**来源** \`${tasksMdPath}\` **第 ${task.lineNo} 行**：

\`\`\`markdown
${task.raw}
\`\`\`

### 请在对话 / Quest 中 @ 引用以下文件

| 角色 | 路径 |
|------|------|
| **规约（验收依据）** | \`${specPath}\` |
| **任务清单全文** | \`${tasksMdPath}\` |
${reqRow}${desRow}
${traceBlock}### 执行说明

- 围绕**本条任务**落实实现或文档修改；以 **Spec** 与 **设计/需求摘录** 为约束。
- **不要依赖终端命令栏**：GlueKit 通过本提示词驱动 IDE 内 Agent / Quest，而非自动执行 \`gk:run\`。
- 完成后请在 **tasks.md** 将对应行勾选为 \`- [x]\`。

### 对齐用标题

**${task.id}** ${task.title}
`;
}

/**
 * 读取 tasks.md，定位行号对应任务，生成提示词写入剪贴板；可选聚焦 Chat 或尝试打开 Quest。
 */
export async function fillSplitTaskContext(opts: FillSplitTaskOptions): Promise<{ ok: boolean; message: string }> {
  const { mode, specPath, tasksMdPath, taskLineNo } = opts;
  assertSafeRel(specPath);
  assertSafeRel(tasksMdPath);
  const text = await readUtf8(tasksMdPath);
  if (text === undefined) {
    return { ok: false, message: '无法读取 tasks.md' };
  }
  const items = parseTasksMdItems(text);
  const task = items.find((t) => t.lineNo === taskLineNo);
  if (!task) {
    return { ok: false, message: `未找到第 ${taskLineNo} 行对应的勾选任务` };
  }
  const reqRel = siblingKrioMarkdown(tasksMdPath, 'requirement.md');
  const desRel = siblingKrioMarkdown(tasksMdPath, 'design.md');
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  let requirementPath: string | undefined;
  let designPath: string | undefined;
  if (root) {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, ...reqRel.split('/').filter(Boolean)));
      requirementPath = reqRel;
    } catch {
      /* 无文件 */
    }
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, ...desRel.split('/').filter(Boolean)));
      designPath = desRel;
    } catch {
      /* 无文件 */
    }
  }
  const body = buildPromptBody(specPath, tasksMdPath, requirementPath, designPath, task);
  await vscode.env.clipboard.writeText(body);
  if (mode === 'chat') {
    await tryOpenAiChatPanelImport();
    return {
      ok: true,
      message: '已复制提示词到剪贴板，并已尝试打开对话面板；请粘贴并 @ 引用表中文件。',
    };
  }
  const questOpened = await tryOpenQoderQuestPanel();
  return {
    ok: true,
    message: questOpened
      ? '已复制 Quest 提示词到剪贴板，并已尝试打开 Qoder Quest；请粘贴并在界面中附加引用文件（见表中路径）。'
      : '已复制 Quest 提示词到剪贴板。请手动打开 Qoder **Quest**，粘贴后在附件中加上 Spec、tasks、design、requirement 等文件。',
  };
}

/** 避免与 messages 循环引用：动态 import 或内联 tryOpenAiChatPanel */
async function tryOpenAiChatPanelImport(): Promise<void> {
  const candidates = [
    'workbench.action.chat.open',
    'workbench.panel.aichat.view.copilot.focus',
    'workbench.panel.chat.view.copilot.focus',
    'aichat.newchataction',
    'cursor.action.openChat',
    'composer.showComposerHistory',
  ];
  for (const cmd of candidates) {
    try {
      await vscode.commands.executeCommand(cmd);
      return;
    } catch {
      /* 继续 */
    }
  }
}
