import vscode from "vscode";
import { TerminalDataProvider } from "./models/terminal-data-provider";
import { CommandType } from "./models/command-type";
import { TerminalNode } from "./models/terminal-node";
import { createExtensionFolder, loadCommandsFromFile } from "./fileOperations";
import { TestViewDragAndDrop } from "./models/testViewDragAndDrop";

const commandTypeValues: CommandType[] = [
  CommandType.GLOBAL,
  CommandType.WORKSPACE,
];

function registerCommands(
  context: vscode.ExtensionContext,
  providers: TerminalDataProvider[]
) {
  const commands = [
    {
      command: "execumate.addGlobalEntry",
      callback: () => providers[0].createTerminal(CommandType.GLOBAL),
    },
    {
      command: "execumate.addWorkspaceEntry",
      callback: () => providers[1].createTerminal(CommandType.WORKSPACE),
    },
    {
      command: "execumate.showTerminal",
      callback: (node: TerminalNode) => node.terminal?.show(),
    },
    {
      command: "execumate.deleteEntry",
      callback: (node: TerminalNode) => node.provider.deleteTerminal(node),
    },
    {
      command: "execumate.runEntry",
      callback: (node: TerminalNode) => node.provider.runTerminal(node),
    },
    {
      command: "execumate.rerunEntry",
      callback: (node: TerminalNode) => node.provider.rerunTerminal(node),
    },
    {
      command: "execumate.stopEntry",
      callback: (node: TerminalNode) => node.provider.stopTerminal(node),
    },
    {
      command: "execumate.editEntry",
      callback: (node: TerminalNode) => node.provider.editTerminal(node),
    },
    // {
    //   command: "execumate.addSubgroupEntry",
    //   callback: (node: TerminalNode) => node.provider.createTerminal()
    // }
  ];

  commands.forEach(({ command, callback }) =>
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback)
    )
  );
}

export async function activate(context: vscode.ExtensionContext) {
  await createExtensionFolder(context);

  const providers = [
    new TerminalDataProvider(context),
    new TerminalDataProvider(context),
  ];
  vscode.window.terminals.forEach((terminal) => terminal.dispose());

  providers.forEach((provider, index) =>
    vscode.window.createTreeView(
      `execumate.${commandTypeValues[index].toLowerCase()}`,
      {
        treeDataProvider: provider,
        showCollapseAll: true,
        canSelectMany: true,
        dragAndDropController: provider,
      }
    )
  );

  registerCommands(context, providers);

  providers.forEach(async (provider, index) => {
    await loadCommandsFromFile(provider, commandTypeValues[index], context);
  });

  vscode.window.onDidCloseTerminal((terminal) => {
    for (const provider of providers) {
      if (provider.handleTerminalClose(terminal) !== -1) {
        break;
      }
    }
  });
}

export function deactivate() {}
