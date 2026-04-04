import * as vscode from 'vscode';

function getNonce(): string {
  let t = '';
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    t += c[Math.floor(Math.random() * c.length)];
  }
  return t;
}

export function buildWorkbenchHtml(
  extensionUri: vscode.Uri,
  webview: vscode.Webview,
  placement: 'sidebar' | 'editor'
): string {
  const nonce = getNonce();
  const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'workbench', 'workbench.js'));
  const style = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'workbench', 'workbench.css'));
  const csp = webview.cspSource;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp}; script-src 'nonce-${nonce}' ${csp};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${style}" rel="stylesheet" />
</head>
<body data-placement="${placement}" class="gk-body--${placement}">
  <div id="root"></div>
  <script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}
