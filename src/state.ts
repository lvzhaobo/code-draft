import * as vscode from 'vscode';

export interface GateRecord {
  passed: boolean;
  passedAt?: string;
}

export interface WorkbenchState {
  version: number;
  currentStep: number;
  skippedSteps: number[];
  checklist: Record<string, boolean>;
  harnessLinks: string[];
  /** Proposal 路径 → 门禁是否通过（人工/AI 检查后点击通过） */
  proposalGate?: Record<string, GateRecord>;
  /** Spec 路径 → Spec v1.0 门禁是否通过 */
  specGate?: Record<string, GateRecord>;
  /** 曾冻结过的 Spec 路径（与文件头 status: frozen 双写，便于快速判断） */
  frozenSpecs?: string[];
  /** Proposal 路径 → 自检项 id → 是否勾选（人工门禁条件，写入 .gluekit/workbench.json） */
  proposalSelfChecks?: Record<string, Record<string, boolean>>;
}

export function defaultState(): WorkbenchState {
  return {
    version: 1,
    currentStep: 0,
    skippedSteps: [],
    checklist: {},
    harnessLinks: [],
    proposalGate: {},
    specGate: {},
    frozenSpecs: [],
    proposalSelfChecks: {},
  };
}

function stateUri(): vscode.Uri | undefined {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    return undefined;
  }
  return vscode.Uri.joinPath(root, '.gluekit', 'workbench.json');
}

export async function loadState(): Promise<WorkbenchState> {
  const file = stateUri();
  if (!file) {
    return defaultState();
  }
  try {
    const buf = await vscode.workspace.fs.readFile(file);
    const parsed = JSON.parse(Buffer.from(buf).toString('utf8')) as Partial<WorkbenchState>;
    const d = defaultState();
    return {
      ...d,
      ...parsed,
      version: 1,
      proposalGate: parsed.proposalGate && typeof parsed.proposalGate === 'object' ? parsed.proposalGate : d.proposalGate,
      specGate: parsed.specGate && typeof parsed.specGate === 'object' ? parsed.specGate : d.specGate,
      frozenSpecs: Array.isArray(parsed.frozenSpecs) ? parsed.frozenSpecs : d.frozenSpecs,
      proposalSelfChecks:
        parsed.proposalSelfChecks && typeof parsed.proposalSelfChecks === 'object'
          ? parsed.proposalSelfChecks
          : d.proposalSelfChecks,
    };
  } catch {
    return defaultState();
  }
}

export async function saveState(state: WorkbenchState): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    return;
  }
  const dir = vscode.Uri.joinPath(root, '.gluekit');
  await vscode.workspace.fs.createDirectory(dir);
  const file = vscode.Uri.joinPath(dir, 'workbench.json');
  const content = Buffer.from(JSON.stringify(state, null, 2), 'utf8');
  await vscode.workspace.fs.writeFile(file, content);
}
