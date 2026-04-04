import * as vscode from 'vscode';
import { dispatchWorkbenchMessage } from './messages';
import { buildWorkbenchHtml } from './workbenchHtml';

let current: vscode.WebviewPanel | undefined;

export function openWorkbenchPanel(extensionUri: vscode.Uri): void {
  if (current) {
    current.reveal(vscode.ViewColumn.One);
    return;
  }

  current = vscode.window.createWebviewPanel(
    'gluekit.workbench.panel',
    'GlueKit 工作台',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
    }
  );

  current.webview.html = buildWorkbenchHtml(extensionUri, current.webview, 'editor');
  current.webview.onDidReceiveMessage((msg) => void dispatchWorkbenchMessage(current!.webview, msg));

  current.onDidDispose(() => {
    current = undefined;
  });

  current.onDidChangeViewState((e) => {
    if (e.webviewPanel.visible) {
      void dispatchWorkbenchMessage(current!.webview, { type: 'requestScan' });
    }
  });
}
