import * as path from 'path';
import * as vscode from 'vscode';

export interface CustomTemplateEntry {
  kind: 'proposal' | 'spec';
  /** 工作区相对路径，如 `.gluekit/templates/proposal/团队-提案.md` */
  source: string;
  /** 展示名（文件名去 .md） */
  label: string;
}

const SUBDIR = {
  proposal: 'proposal',
  spec: 'spec',
} as const;

function isSafeTemplateSource(normalized: string, kind: 'proposal' | 'spec'): boolean {
  const sub = SUBDIR[kind];
  const prefix = `.gluekit/templates/${sub}/`;
  if (!normalized.startsWith(prefix) || normalized.includes('..')) {
    return false;
  }
  const rest = normalized.slice(prefix.length);
  if (!rest || rest.includes('/') || rest.includes('\\') || !rest.toLowerCase().endsWith('.md')) {
    return false;
  }
  return true;
}

async function listOneKind(
  folder: vscode.WorkspaceFolder,
  kind: 'proposal' | 'spec'
): Promise<CustomTemplateEntry[]> {
  const sub = SUBDIR[kind];
  const dir = vscode.Uri.joinPath(folder.uri, '.gluekit', 'templates', sub);
  try {
    await vscode.workspace.fs.stat(dir);
  } catch {
    return [];
  }
  const entries = await vscode.workspace.fs.readDirectory(dir);
  const out: CustomTemplateEntry[] = [];
  for (const [name, type] of entries) {
    if (type === vscode.FileType.File && name.toLowerCase().endsWith('.md')) {
      const source = `.gluekit/templates/${sub}/${name}`.replace(/\\/g, '/');
      out.push({
        kind,
        source,
        label: name.replace(/\.md$/i, ''),
      });
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}

export async function discoverCustomTemplates(): Promise<{
  proposals: CustomTemplateEntry[];
  specs: CustomTemplateEntry[];
}> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return { proposals: [], specs: [] };
  }
  const [proposals, specs] = await Promise.all([listOneKind(folder, 'proposal'), listOneKind(folder, 'spec')]);
  return { proposals, specs };
}

async function openDocument(uri: vscode.Uri): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, { preview: false });
}

export async function createFromCustomTemplate(kind: 'proposal' | 'spec', sourceRel: string): Promise<void> {
  const normalized = sourceRel.replace(/\\/g, '/');
  if (!isSafeTemplateSource(normalized, kind)) {
    void vscode.window.showErrorMessage('GlueKit：非法的自定义模板路径。');
    return;
  }

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showWarningMessage('GlueKit：请先打开工作区文件夹。');
    return;
  }

  const segments = normalized.split('/').filter(Boolean);
  const srcUri = vscode.Uri.joinPath(folder.uri, ...segments);
  let content: Uint8Array;
  try {
    content = await vscode.workspace.fs.readFile(srcUri);
  } catch {
    void vscode.window.showErrorMessage('GlueKit：读取自定义模板失败。');
    return;
  }

  const baseName = path.posix.basename(normalized);
  const targetDir = kind === 'proposal' ? 'proposals' : 'specs';
  const targetUri = vscode.Uri.joinPath(folder.uri, targetDir, baseName);

  let outUri = targetUri;
  try {
    await vscode.workspace.fs.stat(targetUri);
    const stem = baseName.replace(/\.md$/i, '');
    const suggested = `${stem}-copy.md`;
    const name = await vscode.window.showInputBox({
      title: 'GlueKit：目标文件已存在',
      prompt: `请输入保存到 ${targetDir}/ 下的新文件名`,
      value: suggested,
    });
    if (!name) {
      return;
    }
    const safe = name.toLowerCase().endsWith('.md') ? name : `${name}.md`;
    if (safe.includes('..') || safe.includes('/') || safe.includes('\\')) {
      void vscode.window.showErrorMessage('GlueKit：文件名不合法。');
      return;
    }
    outUri = vscode.Uri.joinPath(folder.uri, targetDir, safe);
    try {
      await vscode.workspace.fs.stat(outUri);
      void vscode.window.showWarningMessage('GlueKit：该文件名也已存在，已取消。');
      return;
    } catch {
      /* ok */
    }
  } catch {
    /* targetUri 可用 */
  }

  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder.uri, targetDir));
  await vscode.workspace.fs.writeFile(outUri, content);
  await openDocument(outUri);
  void vscode.window.showInformationMessage(
    `GlueKit：已从自定义模板创建 ${vscode.workspace.asRelativePath(outUri)}`
  );
}
