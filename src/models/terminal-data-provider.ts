import {
  TreeDataProvider,
  EventEmitter,
  Event,
  TreeItem,
  TreeItemCollapsibleState,
  ThemeIcon,
  ProviderResult,
  window,
  Terminal,
  extensions,
  workspace,
} from "vscode";
import { TerminalNode } from "./terminal-node";
import { State } from "./state";
import { CommandType } from "./command-type";
import fs from "fs";
import path from "path";

export class TerminalDataProvider implements TreeDataProvider<TerminalNode> {
  private _onDidChangeTreeData: EventEmitter<TerminalNode | undefined> =
    new EventEmitter<TerminalNode | undefined>();
  readonly onDidChangeTreeData: Event<TerminalNode | undefined> =
    this._onDidChangeTreeData.event;

  public terminals: TerminalNode[] = [];

  getTreeItem(element: TerminalNode): TreeItem {
    const treeItem = new TreeItem(element.label, TreeItemCollapsibleState.None);
    treeItem.iconPath = new ThemeIcon(
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

  getChildren(element?: TerminalNode): ProviderResult<TerminalNode[]> {
    if (!element) {
      return this.terminals;
    }
    return [];
  }

  createTerminal(cType: CommandType) {
    let inputBox = window.createInputBox();
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

  handleTerminalClose(closedTerminal: Terminal) {
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
        ? extensions.all[0].extensionPath
        : workspace.workspaceFolders?.[0].uri.fsPath;
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
      ? extensions.all[0].extensionPath
      : workspace.workspaceFolders && workspace.workspaceFolders[0].uri.fsPath;
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
    node.terminal = window.createTerminal(node.label);
    node.terminal.show(true);
    node.terminal.sendText(node.command);
    node.state = State.RUNNING;
    this._onDidChangeTreeData.fire(undefined);
  }

  rerunTerminal(node: TerminalNode) {
    node.terminal?.dispose();
    node.terminal = window.createTerminal(node.label);
    node.terminal?.sendText(node.command);
    node.state = State.RUNNING;
    this._onDidChangeTreeData.fire(undefined);
  }

  editTerminal(node: TerminalNode) {
    let inputBox = window.createInputBox();
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
