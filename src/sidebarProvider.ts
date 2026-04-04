import * as vscode from 'vscode';
import { dispatchWorkbenchMessage, pushScanAndState } from './messages';
import { buildWorkbenchHtml } from './workbenchHtml';

export class WorkbenchSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'gluekit.workbench.sidebar';

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public refresh(): void {
    void this.pushData();
  }

  private async pushData(): Promise<void> {
    const w = this._view?.webview;
    if (!w) {
      return;
    }
    await pushScanAndState(w);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
    };
    webviewView.webview.html = buildWorkbenchHtml(this._extensionUri, webviewView.webview, 'sidebar');

    webviewView.webview.onDidReceiveMessage((msg) =>
      void dispatchWorkbenchMessage(webviewView.webview, msg)
    );

    const folder = vscode.workspace.workspaceFolders?.[0];
    let watcher: vscode.FileSystemWatcher | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    if (folder) {
      watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, '**/*.md'));
      const fire = () => {
        if (debounce) {
          clearTimeout(debounce);
        }
        debounce = setTimeout(() => void this.pushData(), 450);
      };
      watcher.onDidChange(fire);
      watcher.onDidCreate(fire);
      watcher.onDidDelete(fire);
    }

    webviewView.onDidDispose(() => {
      this._view = undefined;
      if (debounce) {
        clearTimeout(debounce);
      }
      watcher?.dispose();
    });
  }
}
