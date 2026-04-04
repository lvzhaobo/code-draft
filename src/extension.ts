import * as vscode from 'vscode';
import { setExtensionVersion } from './extensionVersion';
import { openWorkbenchPanel } from './panel';
import { WorkbenchSidebarProvider } from './sidebarProvider';
import { createProposalTemplate, createSpecTemplate } from './templates';

export function activate(context: vscode.ExtensionContext): void {
  setExtensionVersion(String(context.extension.packageJSON.version ?? ''));

  const provider = new WorkbenchSidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(WorkbenchSidebarProvider.viewType, provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gluekit.workbench.openPanel', () => {
      openWorkbenchPanel(context.extensionUri);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gluekit.workbench.refresh', () => provider.refresh())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gluekit.workbench.createProposal', () => createProposalTemplate())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gluekit.workbench.createSpec', () => createSpecTemplate())
  );
}

export function deactivate(): void {}
