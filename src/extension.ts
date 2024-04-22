import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

function loadCommandsFromFile(
  provider: TerminalDataProvider,
  cType: CommandType
) {
  const isGlobal = cType === CommandType.GLOBAL;
  const fileName = isGlobal
    ? "global-execumate.json"
    : "workspace-execumate.json";
  const folderPath = isGlobal
    ? vscode.extensions.all[0].extensionPath
    : vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (folderPath) {
    const filePath = path.join(folderPath, fileName);

    if (fs.existsSync(filePath)) {
      const commands = JSON.parse(fs.readFileSync(filePath, "utf8"));
      commands.forEach((item: any) => {
        if (
          !provider.terminals.some(
            (node) =>
              node.command === item.command &&
              (!isGlobal || node.cType === CommandType.GLOBAL)
          )
        ) {
          provider.addTerminalNode(
            item.command,
            State.STOPPED,
            item.label,
            cType,
            provider
          );
        }
      });
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  vscode.window.terminals.forEach((terminal) => {
    terminal.dispose();
  });

  const globalProvider = new TerminalDataProvider();
  const workspaceProvider = new TerminalDataProvider();
  const temporaryProvider = new TerminalDataProvider();

  vscode.window.createTreeView("execumate.global", {
    treeDataProvider: globalProvider,
  });
  vscode.window.createTreeView("execumate.workspace", {
    treeDataProvider: workspaceProvider,
  });
  vscode.window.createTreeView("execumate.temporary", {
    treeDataProvider: temporaryProvider,
  });

  loadCommandsFromFile(globalProvider, CommandType.GLOBAL);
  loadCommandsFromFile(workspaceProvider, CommandType.WORKSPACE);

  context.subscriptions.push(
    vscode.commands.registerCommand("execumate.addGlobalEntry", () => {
      globalProvider.createTerminal(CommandType.GLOBAL);
    }),
    vscode.commands.registerCommand("execumate.addWorkspaceEntry", () => {
      workspaceProvider.createTerminal(CommandType.WORKSPACE);
    }),
    vscode.commands.registerCommand("execumate.addTemporaryEntry", () => {
      temporaryProvider.createTerminal(CommandType.TEMPORARY);
    })
  );

  vscode.window.onDidCloseTerminal((terminal) => {
    if (globalProvider.handleTerminalClose(terminal) === -1) {
      if (workspaceProvider.handleTerminalClose(terminal) === -1) {
        temporaryProvider.handleTerminalClose(terminal);
      }
    }
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "execumate.showTerminal",
      (node: TerminalNode) => {
        node.terminal?.show();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "execumate.deleteEntry",
      (node: TerminalNode) => {
        node.provider.deleteTerminal(node);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "execumate.runEntry",
      (node: TerminalNode) => {
        node.provider.runTerminal(node);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "execumate.rerunEntry",
      (node: TerminalNode) => {
        node.provider.rerunTerminal(node);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "execumate.stopEntry",
      (node: TerminalNode) => {
        node.provider.stopTerminal(node);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "execumate.editEntry",
      (node: TerminalNode) => {
        node.provider.editTerminal(node);
      }
    )
  );
}

export enum State {
  RUNNING,
  STOPPED,
  ERROR,
}

export enum CommandType {
  GLOBAL = "Global",
  WORKSPACE = "Workspace",
  TEMPORARY = "Temporary",
}

export function deactivate() {}

class TerminalNode {
  constructor(
    public label: string,
    public command: string,
    public state: State,
    public cType: CommandType,
    public provider: TerminalDataProvider,
    public terminal?: vscode.Terminal
  ) {}
}

class TerminalDataProvider implements vscode.TreeDataProvider<TerminalNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<TerminalNode | undefined> =
    new vscode.EventEmitter<TerminalNode | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TerminalNode | undefined> =
    this._onDidChangeTreeData.event;

  public terminals: TerminalNode[] = [];

  getTreeItem(element: TerminalNode): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.label,
      vscode.TreeItemCollapsibleState.None
    );
    treeItem.iconPath = new vscode.ThemeIcon(
      element.state === State.RUNNING
        ? "terminal"
        : element.state === State.STOPPED
        ? "debug-disconnect"
        : "error"
    );
    treeItem.contextValue = `terminalNode-${State[element.state]}`;
    treeItem.description =
      element.label === element.command ? "" : element.command;
    treeItem.command = {
      command: "execumate.showTerminal",
      arguments: [element, this],
      title: "Show Terminal",
    };
    return treeItem;
  }

  getChildren(element?: TerminalNode): vscode.ProviderResult<TerminalNode[]> {
    if (!element) {
      return this.terminals;
    }
    return [];
  }

  createTerminal(cType: CommandType) {
    let inputBox = vscode.window.createInputBox();
    inputBox.title = "Create Execumate Terminal";
    inputBox.placeholder = "npm run start";
    inputBox.step = 1;
    inputBox.totalSteps = 2;
    inputBox.show();

    let command = "";
    let label = "";

    inputBox.onDidAccept(() => {
      if (inputBox.step === 1) {
        command = inputBox.value;
        if (command) {
          inputBox.value = "";
          inputBox.step = 2;
          inputBox.prompt =
            "Enter a label associated with the command: (optional)";
          inputBox.placeholder = "A cool label";
        }
      } else if (inputBox.step === 2) {
        label = inputBox.value;
        inputBox.value = "";
        inputBox.hide();
        const isGlobal = cType === CommandType.GLOBAL;
        if (cType && cType !== CommandType.TEMPORARY) {
          this.saveCommandToJson(command, label, isGlobal);
        }
        this.addTerminalNode(command, State.STOPPED, label, cType, this);
      }
    });
  }

  handleTerminalClose(closedTerminal: vscode.Terminal) {
    const nodeIndex = this.terminals.findIndex(
      (node) => node.terminal === closedTerminal
    );
    if (nodeIndex !== -1) {
      this.terminals[nodeIndex].state = State.STOPPED; // Actualiza el estado a STOPPED o cualquier otro estado deseado
      this.terminals[nodeIndex].terminal = undefined; // Opcional: desasociar la terminal del nodo
      this._onDidChangeTreeData.fire(this.terminals[nodeIndex]); // Notifica al TreeView para que se actualice
      return nodeIndex;
    }
    return -1;
  }

  addTerminalNode(
    command: string,
    state: State,
    label: string | undefined,
    cType: CommandType,
    provider: TerminalDataProvider
  ) {
    const terminalNode = new TerminalNode(
      label ?? command,
      command,
      state,
      cType,
      provider
    );
    this.terminals.push(terminalNode);
    this._onDidChangeTreeData.fire(undefined);
  }

  saveCommandsToFile(terminals: TerminalNode[], cType: CommandType) {
    if (cType !== CommandType.TEMPORARY) {
      const isGlobal = cType === CommandType.GLOBAL;
      const filteredTerminals = terminals.filter((c) => c.cType === cType);
      const fileName = isGlobal
        ? "global-execumate.json"
        : "workspace-execumate.json";
      const folderPath = isGlobal
        ? vscode.extensions.all[0].extensionPath
        : vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      if (folderPath) {
        const filePath = path.join(folderPath, fileName);
        const mappedCommands = filteredTerminals.map((t) => ({
          command: t.command,
          label: t.label,
        }));
        fs.writeFileSync(filePath, JSON.stringify(mappedCommands));
      }
    }
  }

  saveCommandToJson(command: string, label: string, isGlobal: boolean) {
    const fileName = isGlobal
      ? "global-execumate.json"
      : "workspace-execumate.json";
    const folderPath = isGlobal
      ? vscode.extensions.all[0].extensionPath
      : vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders[0].uri.fsPath;
    if (folderPath) {
      const filePath = path.join(folderPath, fileName);

      let commands = [];
      if (fs.existsSync(filePath)) {
        commands = JSON.parse(fs.readFileSync(filePath, "utf8"));
      }
      commands.push({ label, command });
      fs.writeFileSync(filePath, JSON.stringify(commands));
    }
  }

  deleteTerminal(node: TerminalNode) {
    node.terminal?.dispose();
    this.terminals = this.terminals.filter((t) => t !== node);
    this._onDidChangeTreeData.fire(undefined);

    this.saveCommandsToFile(this.terminals, node.cType);
  }

  runTerminal(node: TerminalNode) {
    node.terminal = vscode.window.createTerminal(node.label);
    node.terminal.show(true);
    node.terminal.sendText(node.command);
    node.state = State.RUNNING;
    this._onDidChangeTreeData.fire(undefined);
  }

  rerunTerminal(node: TerminalNode) {
    node.terminal?.dispose();
    node.terminal = vscode.window.createTerminal(node.label);
    node.terminal?.sendText(node.command);
    node.state = State.RUNNING;
    this._onDidChangeTreeData.fire(undefined);
  }

  editTerminal(node: TerminalNode) {
    let inputBox = vscode.window.createInputBox();
    inputBox.title = "Create Execumate Terminal";
    inputBox.placeholder = "npm run start";
    inputBox.step = 1;
    inputBox.totalSteps = 2;
    inputBox.show();

    let command = "";
    let label = "";

    inputBox.onDidAccept(() => {
      if (inputBox.step === 1) {
        command = inputBox.value;
        if (command) {
          inputBox.value = "";
          inputBox.step = 2;
          inputBox.prompt =
            "Enter a label associated with the command: (optional)";
          inputBox.placeholder = "A cool label";
        }
      } else if (inputBox.step === 2) {
        label = inputBox.value;
        inputBox.value = "";
        inputBox.hide();
        node.label = label ?? command;
        node.command = command;
        this._onDidChangeTreeData.fire(undefined);
      }
    });
  }

  stopTerminal(node: TerminalNode) {
    node.terminal?.dispose();
    node.state = State.STOPPED;
    this._onDidChangeTreeData.fire(undefined);
  }
}
