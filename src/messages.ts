import * as vscode from 'vscode';
import { createFromCustomTemplate, discoverCustomTemplates } from './customTemplates';
import { appendAgentsScenario, openAgentsInEditor } from './agentsPresets';
import { ensureHarnessInitAll, ensureHarnessInitItem, ensureReferenceLibrary } from './harnessInit';
import { getExtensionVersion } from './extensionVersion';
import { scanWorkspace } from './scan';
import { defaultState, loadState, saveState, type WorkbenchState } from './state';
import { createScaffoldKit, parseScaffoldKind } from './exampleKits';
import { appendRoundNotesFromClipboard, ensureGluekitQoderRule } from './qoderKit';
import { fillSplitTaskContext } from './taskContext';
import { createProposalTemplate, createSpecTemplate } from './templates';
import {
  buildProposalToSpecAiPrompt,
  createSpecDraftFromProposal,
  freezeSpec,
  generateKrioSplit,
  getRunnableTasksForSpec,
  isSpecFrozen,
  runTaskCommand,
  setProposalGatePassed,
  setSpecGatePassed,
} from './workflow';

/** 复制提示词后尝试聚焦 Chat（VS Code / Cursor 命令因版本而异，依次尝试） */
async function tryOpenAiChatPanel(): Promise<void> {
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
      /* 继续尝试下一命令 */
    }
  }
}

export async function pushScanAndState(webview: vscode.Webview): Promise<void> {
  const [scan, customTemplates] = await Promise.all([scanWorkspace(), discoverCustomTemplates()]);
  const state = await loadState();
  const specFrozen: Record<string, boolean> = {};
  for (const s of scan.specs) {
    specFrozen[s] = await isSpecFrozen(s);
  }
  webview.postMessage({
    type: 'scanResult',
    payload: { ...scan, customTemplates, specFrozen, extensionVersion: getExtensionVersion() },
  });
  webview.postMessage({ type: 'stateResult', payload: state });
}

export async function dispatchWorkbenchMessage(
  webview: vscode.Webview,
  message: { type?: string; payload?: unknown }
): Promise<void> {
  const type = message.type;
  try {
    switch (type) {
      case 'ready':
      case 'requestScan':
        await pushScanAndState(webview);
        break;
      case 'getState':
        webview.postMessage({ type: 'stateResult', payload: await loadState() });
        break;
      case 'saveState': {
        const p = message.payload as Partial<WorkbenchState> | undefined;
        if (p && typeof p === 'object') {
          const d = defaultState();
          const merged: WorkbenchState = {
            ...d,
            ...p,
            version: 1,
            skippedSteps: Array.isArray(p.skippedSteps) ? p.skippedSteps : d.skippedSteps,
            checklist: typeof p.checklist === 'object' && p.checklist !== null ? p.checklist : {},
            harnessLinks: Array.isArray(p.harnessLinks) ? p.harnessLinks : [],
            proposalGate:
              p.proposalGate && typeof p.proposalGate === 'object' ? p.proposalGate : d.proposalGate,
            specGate: p.specGate && typeof p.specGate === 'object' ? p.specGate : d.specGate,
            frozenSpecs: Array.isArray(p.frozenSpecs) ? p.frozenSpecs : d.frozenSpecs,
            proposalSelfChecks:
              p.proposalSelfChecks && typeof p.proposalSelfChecks === 'object'
                ? p.proposalSelfChecks
                : d.proposalSelfChecks,
          };
          await saveState(merged);
        }
        break;
      }
      case 'openFile': {
        const rel = String(message.payload ?? '').replace(/\\/g, '/');
        if (!rel || rel.includes('..')) {
          break;
        }
        const root = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!root) {
          webview.postMessage({ type: 'error', payload: '未打开工作区。' });
          break;
        }
        const uri = vscode.Uri.joinPath(root, rel);
        try {
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { preview: false });
        } catch {
          webview.postMessage({ type: 'error', payload: `无法打开：${rel}` });
        }
        break;
      }
      case 'harnessInitItem': {
        const id = String((message.payload as { id?: string } | undefined)?.id ?? '');
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
          webview.postMessage({ type: 'error', payload: '未打开工作区。' });
          break;
        }
        const res = await ensureHarnessInitItem(folder, id);
        if (res.errors.length) {
          webview.postMessage({ type: 'error', payload: res.errors.join('; ') });
        } else if (res.created.length) {
          void vscode.window.showInformationMessage(`GlueKit：已创建 ${res.created.join(', ')}`);
        } else {
          void vscode.window.showInformationMessage(
            `GlueKit：未新建文件（已存在或已跳过）：${res.skipped.join(', ') || id}`
          );
        }
        await pushScanAndState(webview);
        break;
      }
      case 'glueInitReference': {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
          webview.postMessage({ type: 'error', payload: '未打开工作区。' });
          break;
        }
        const res = await ensureReferenceLibrary(folder);
        if (res.errors.length) {
          webview.postMessage({ type: 'error', payload: res.errors.join('; ') });
        } else if (res.created.length) {
          void vscode.window.showInformationMessage(`GlueKit：已创建 ${res.created.join(', ')}`);
        } else {
          void vscode.window.showInformationMessage('GlueKit：reference/README.md 已存在，未覆盖。');
        }
        await pushScanAndState(webview);
        break;
      }
      case 'harnessInitAll': {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
          webview.postMessage({ type: 'error', payload: '未打开工作区。' });
          break;
        }
        const res = await ensureHarnessInitAll(folder);
        if (res.errors.length) {
          webview.postMessage({ type: 'error', payload: res.errors.join('; ') });
        } else {
          const head = res.created.slice(0, 10).join(', ');
          const more = res.created.length > 10 ? ` 等共 ${res.created.length} 处` : '';
          void vscode.window.showInformationMessage(
            res.created.length
              ? `GlueKit：已初始化 ${res.created.length} 个路径：${head}${more}`
              : 'GlueKit：建议布局项均已存在，未覆盖任何文件。'
          );
        }
        await pushScanAndState(webview);
        break;
      }
      case 'revealInExplorer': {
        const rel = String(message.payload ?? '').replace(/\\/g, '/');
        if (!rel || rel.includes('..')) {
          break;
        }
        const ok = await revealWorkspaceResourceInExplorer(rel);
        if (!ok) {
          webview.postMessage({ type: 'error', payload: `无法在资源管理器中定位：${rel}` });
        }
        break;
      }
      case 'createFromTemplate': {
        const kind = String(message.payload ?? '');
        if (kind === 'proposal') {
          await createProposalTemplate();
        } else if (kind === 'spec') {
          await createSpecTemplate();
        }
        await pushScanAndState(webview);
        break;
      }
      case 'ensureQoderGluekitRule': {
        const res = await ensureGluekitQoderRule();
        if (!res.ok) {
          webview.postMessage({ type: 'error', payload: res.message });
        } else {
          void vscode.window.showInformationMessage(`GlueKit：${res.message}`);
        }
        await pushScanAndState(webview);
        break;
      }
      case 'fillSplitTaskContext': {
        const p = message.payload as {
          mode?: string;
          specPath?: string;
          tasksMdPath?: string;
          taskLineNo?: number;
        };
        const mode = p?.mode === 'quest' ? 'quest' : 'chat';
        const specPath = String(p?.specPath ?? '').replace(/\\/g, '/');
        const tasksMdPath = String(p?.tasksMdPath ?? '').replace(/\\/g, '/');
        const taskLineNo =
          typeof p?.taskLineNo === 'number' ? p.taskLineNo : Number(String(p?.taskLineNo ?? '').trim());
        if (!specPath || specPath.includes('..') || !tasksMdPath || tasksMdPath.includes('..') || !Number.isFinite(taskLineNo)) {
          webview.postMessage({ type: 'error', payload: '任务上下文参数无效。' });
          break;
        }
        try {
          const res = await fillSplitTaskContext({ mode, specPath, tasksMdPath, taskLineNo });
          if (!res.ok) {
            webview.postMessage({ type: 'error', payload: res.message });
          } else {
            void vscode.window.showInformationMessage(`GlueKit：${res.message}`);
          }
        } catch (e) {
          webview.postMessage({ type: 'error', payload: String(e) });
        }
        break;
      }
      case 'appendQoderRoundNotesFromClipboard': {
        const res = await appendRoundNotesFromClipboard();
        if (!res.ok) {
          webview.postMessage({ type: 'error', payload: res.message });
        } else {
          void vscode.window.showInformationMessage(`GlueKit：${res.message}`);
        }
        await pushScanAndState(webview);
        break;
      }
      case 'createScaffold': {
        const kind = parseScaffoldKind(String(message.payload ?? ''));
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!kind) {
          webview.postMessage({ type: 'error', payload: '未知的脚手架类型。' });
          break;
        }
        if (!folder) {
          webview.postMessage({ type: 'error', payload: '未打开工作区。' });
          break;
        }
        const res = await createScaffoldKit(folder, kind);
        if (res.errors.filter(Boolean).length) {
          webview.postMessage({ type: 'error', payload: res.errors.filter(Boolean).join('; ') });
        }
        if (res.rootRel) {
          const head = res.created.slice(0, 8).join(', ');
          const more = res.created.length > 8 ? ` 等共 ${res.created.length} 个路径` : '';
          void vscode.window.showInformationMessage(
            `GlueKit：已在工作区创建 ${res.rootRel}/（${res.created.length} 项）${head ? `：${head}${more}` : ''}`
          );
          await revealWorkspaceResourceInExplorer(res.rootRel);
        }
        await pushScanAndState(webview);
        break;
      }
      case 'createFromCustomTemplate': {
        const p = message.payload as { kind?: string; source?: string } | undefined;
        const k = p?.kind === 'spec' ? 'spec' : p?.kind === 'proposal' ? 'proposal' : '';
        if (k && typeof p?.source === 'string') {
          await createFromCustomTemplate(k, p.source);
        }
        await pushScanAndState(webview);
        break;
      }
      case 'proposalGateSet': {
        const p = message.payload as { path?: string; passed?: boolean } | undefined;
        if (p?.path) {
          await setProposalGatePassed(p.path, p.passed === true);
        }
        await pushScanAndState(webview);
        break;
      }
      case 'setProposalSelfCheck': {
        const p = message.payload as { path?: string; id?: string; checked?: boolean } | undefined;
        const rel = String(p?.path ?? '').replace(/\\/g, '/');
        const id = String(p?.id ?? '');
        if (!rel || rel.includes('..') || !id) {
          break;
        }
        const s = await loadState();
        const next = { ...(s.proposalSelfChecks || {}) };
        const row = { ...(next[rel] || {}) };
        row[id] = p?.checked === true;
        next[rel] = row;
        await saveState({ ...s, proposalSelfChecks: next });
        await pushScanAndState(webview);
        break;
      }
      case 'copyGlueRefLine': {
        const rel = String(message.payload ?? '').replace(/\\/g, '/');
        if (!rel || rel.includes('..')) {
          break;
        }
        const base = rel.split('/').pop() || rel;
        const line = `请在实现中结合仓库文件 \`${rel}\`（可在 Cursor Chat 用 @${base} 引用），并遵守其中约定。`;
        await vscode.env.clipboard.writeText(line);
        void vscode.window.showInformationMessage('GlueKit：已复制「@引用」说明到剪贴板');
        break;
      }
      case 'copyProposalAiPrompt': {
        const rel = String(message.payload ?? '').replace(/\\/g, '/');
        if (!rel || rel.includes('..')) {
          break;
        }
        try {
          const text = await buildProposalToSpecAiPrompt(rel);
          await vscode.env.clipboard.writeText(text);
          await tryOpenAiChatPanel();
          void vscode.window.showInformationMessage(
            'GlueKit：已复制「Proposal → Spec」提示词，并已尝试打开 Chat 面板（若未弹出请手动打开）'
          );
        } catch (e) {
          webview.postMessage({ type: 'error', payload: String(e) });
        }
        break;
      }
      case 'appendAgentsPreset': {
        const p = message.payload as { preset?: string; path?: string } | undefined;
        const preset = String(p?.preset ?? '');
        const agentsPath = String(p?.path ?? 'AGENTS.md').replace(/\\/g, '/');
        if (!preset || agentsPath.includes('..')) {
          break;
        }
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
          webview.postMessage({ type: 'error', payload: '未打开工作区。' });
          break;
        }
        const res = await appendAgentsScenario(folder, agentsPath, preset);
        if (!res.ok) {
          webview.postMessage({ type: 'error', payload: res.message });
        } else {
          void vscode.window.showInformationMessage(`GlueKit：${res.message}`);
          await openAgentsInEditor(agentsPath);
        }
        webview.postMessage({ type: 'agentsFileTouched', payload: { path: agentsPath } });
        await pushScanAndState(webview);
        break;
      }
      case 'specGateSet': {
        const p = message.payload as { path?: string; passed?: boolean } | undefined;
        if (p?.path) {
          await setSpecGatePassed(p.path, p.passed === true);
        }
        await pushScanAndState(webview);
        break;
      }
      case 'freezeSpec': {
        const rel = String(message.payload ?? '').replace(/\\/g, '/');
        if (rel && !rel.includes('..')) {
          const err = await freezeSpec(rel);
          if (err) {
            webview.postMessage({ type: 'error', payload: err });
          }
        }
        await pushScanAndState(webview);
        break;
      }
      case 'createSpecFromProposal': {
        const rel = String(message.payload ?? '').replace(/\\/g, '/');
        if (rel && !rel.includes('..')) {
          const err = await createSpecDraftFromProposal(rel);
          if (err) {
            webview.postMessage({ type: 'error', payload: err });
          }
        }
        await pushScanAndState(webview);
        break;
      }
      case 'splitFromSpec': {
        const rel = String(message.payload ?? '').replace(/\\/g, '/');
        if (rel && !rel.includes('..')) {
          const err = await generateKrioSplit(rel);
          if (err) {
            webview.postMessage({ type: 'error', payload: err });
          }
        }
        await pushScanAndState(webview);
        break;
      }
      case 'getRunnableTasks': {
        const rel = String(message.payload ?? '').replace(/\\/g, '/');
        if (rel && !rel.includes('..')) {
          const tasks = await getRunnableTasksForSpec(rel);
          webview.postMessage({ type: 'runnableTasksResult', payload: { spec: rel, tasks } });
        } else {
          webview.postMessage({ type: 'runnableTasksResult', payload: { spec: '', tasks: [] } });
        }
        break;
      }
      case 'runShell': {
        const cmd = String(message.payload ?? '');
        if (cmd.trim()) {
          await runTaskCommand(cmd.trim());
        }
        break;
      }
      case 'previewTextFile': {
        const p = message.payload as {
          path?: string;
          maxLines?: number;
          maxChars?: number;
          channel?: string;
        } | undefined;
        const rel = String(p?.path ?? '').replace(/\\/g, '/');
        const ch = String(p?.channel ?? '');
        const channel = ch === 'qoder' ? 'qoder' : ch === 'workflow' ? 'workflow' : '';
        const maxLines = typeof p?.maxLines === 'number' && p.maxLines > 0 ? Math.min(p.maxLines, 120) : 56;
        const maxChars = typeof p?.maxChars === 'number' && p.maxChars > 0 ? Math.min(p.maxChars, 12000) : 6000;
        const previewPayload = (extra: Record<string, unknown>) =>
          channel === 'qoder' || channel === 'workflow' ? { ...extra, channel } : extra;
        if (!rel || rel.includes('..')) {
          webview.postMessage({
            type: 'filePreviewResult',
            payload: previewPayload({ path: rel, text: '', truncated: false, error: '路径无效' }),
          });
          break;
        }
        if (channel === 'qoder' && !rel.startsWith('.qoder/')) {
          webview.postMessage({
            type: 'filePreviewResult',
            payload: previewPayload({
              path: rel,
              text: '',
              truncated: false,
              error: '仅允许预览工作区内 .qoder/ 路径',
            }),
          });
          break;
        }
        const root = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!root) {
          webview.postMessage({
            type: 'filePreviewResult',
            payload: previewPayload({ path: rel, text: '', truncated: false, error: '未打开工作区' }),
          });
          break;
        }
        const uri = vscode.Uri.joinPath(root, ...rel.split('/').filter(Boolean));
        try {
          const buf = await vscode.workspace.fs.readFile(uri);
          let text = Buffer.from(buf).toString('utf8');
          const lines = text.split(/\r?\n/);
          let truncated = false;
          if (lines.length > maxLines) {
            text = lines.slice(0, maxLines).join('\n');
            truncated = true;
          }
          if (text.length > maxChars) {
            text = text.slice(0, maxChars);
            truncated = true;
          }
          webview.postMessage({
            type: 'filePreviewResult',
            payload: previewPayload({ path: rel, text, truncated, error: '' }),
          });
        } catch {
          webview.postMessage({
            type: 'filePreviewResult',
            payload: previewPayload({ path: rel, text: '', truncated: false, error: '无法读取文件' }),
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    webview.postMessage({ type: 'error', payload: String(e) });
  }
}

/** 在侧栏资源管理器中聚焦并选中工作区内的文件或文件夹 */
async function revealWorkspaceResourceInExplorer(rel: string): Promise<boolean> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return false;
  }
  const uri = vscode.Uri.joinPath(folder.uri, ...rel.split('/').filter(Boolean));
  const tryCmd = async (cmd: string, ...args: unknown[]) => {
    try {
      await vscode.commands.executeCommand(cmd, ...args);
      return true;
    } catch {
      return false;
    }
  };
  if (await tryCmd('revealInExplorer', uri)) {
    return true;
  }
  try {
    const st = await vscode.workspace.fs.stat(uri);
    if (st.type === vscode.FileType.File) {
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: true });
      if (await tryCmd('revealInExplorer', uri)) {
        return true;
      }
    }
    if (st.type === vscode.FileType.Directory) {
      if (await tryCmd('revealInExplorer', uri)) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}
