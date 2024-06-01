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
  ExtensionContext,
  QuickPickItemKind,
} from "vscode";
import { TerminalNode } from "./terminal-node";
import { State } from "./state";
import { CommandType } from "./command-type";
import { saveCommandToJson, saveCommandsToFile } from "../fileOperations";
import { QuickPickVariables } from "./quickpick-variables";

export class TerminalDataProvider implements TreeDataProvider<TerminalNode> {
  private _onDidChangeTreeData: EventEmitter<TerminalNode | undefined> =
    new EventEmitter<TerminalNode | undefined>();
  readonly onDidChangeTreeData: Event<TerminalNode | undefined> =
    this._onDidChangeTreeData.event;

  public terminals: TerminalNode[] = [];
  private _context: ExtensionContext;

  constructor(context: ExtensionContext) {
    this._context = context;
  }

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
    inputBox.totalSteps = 3;
    inputBox.show();

    let command = "";
    let label = "";
    let variables = [];

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
        inputBox.step = 3;
        inputBox.prompt =
          "Enter any optional variables this command can have separated by commas: (optional) ";
        inputBox.placeholder = "--port 3000,--port 3001,--open";
      } else if (inputBox.step === 3) {
        variables = inputBox.value.split(",");
        inputBox.value = "";
        inputBox.hide();

        this.addTerminalNode(
          command,
          State.STOPPED,
          label,
          cType,
          this,
          variables
        );

        const isGlobal = cType === CommandType.GLOBAL;
        if (cType && cType !== CommandType.TEMPORARY) {
          saveCommandToJson(command, label, isGlobal, this._context, variables);
        }
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
    label: string,
    cType: CommandType,
    provider: TerminalDataProvider,
    variables: string[]
  ) {
    const terminalNode = new TerminalNode(
      label ?? command,
      command,
      state,
      cType,
      provider,
      variables
    );
    this.terminals.push(terminalNode);
    this._onDidChangeTreeData.fire(undefined);

    return terminalNode;
  }

  deleteTerminal(node: TerminalNode) {
    node.terminal?.dispose();
    this.terminals = this.terminals.filter((t) => t !== node);
    this._onDidChangeTreeData.fire(undefined);

    saveCommandsToFile(this.terminals, node.cType, this._context);
  }

  runTerminal(node: TerminalNode) {
    let command = node.command;
    if (node.variables.length > 0) {
      this.handleVariableSelection(node, command);
    } else {
      this.runCommandInTerminal(node, command);
    }
  }

  handleVariableSelection(node: TerminalNode, command: string) {
    const items: QuickPickVariables[] = this.getQuickPickItems(node);

    window
      .showQuickPick(items, {
        canPickMany: true,
        placeHolder: "Select variables",
        title: "Select variables",
      })
      .then((selectedItems) => {
        if (!selectedItems) {
          return;
        }

        const saveItem = selectedItems.find((item) => item.code === "save");
        const variables = this.getSelectedVariables(selectedItems);

        if (variables !== "") {
          command = `${command} ${variables}`;
        }

        if (saveItem) {
          this.handleSaveCommand(node, command);
        } else {
          this.runCommandInTerminal(node, command);
        }
      });
  }

  getQuickPickItems(node: TerminalNode): QuickPickVariables[] {
    return [
      ...node.variables.map((v) => ({ label: v })),
      { label: "Actions", kind: QuickPickItemKind.Separator },
      { label: "Save as a separate command and run it.", code: "save" },
    ];
  }

  getSelectedVariables(selectedItems: QuickPickVariables[]): string {
    return selectedItems
      .filter((item) => item.code !== "save")
      .map((item) => item.label)
      .join(" ");
  }

  handleSaveCommand(node: TerminalNode, command: string) {
    const terminalNode = this.addTerminalNode(
      command,
      State.STOPPED,
      "",
      node.cType,
      node.provider,
      []
    );

    const isGlobal = node.cType === CommandType.GLOBAL;
    if (node.cType && node.cType !== CommandType.TEMPORARY) {
      saveCommandToJson(command, "", isGlobal, this._context, []);
    }

    this.runCommandInTerminal(terminalNode, command);
  }

  runCommandInTerminal(node: TerminalNode, command: string) {
    node.terminal = window.createTerminal(node.label);
    node.terminal.show(true);
    node.terminal.sendText(command);
    this.updateNodeState(node, State.RUNNING);
  }

  updateNodeState(node: TerminalNode, state: State) {
    node.state = state;
    this._onDidChangeTreeData.fire(undefined);
  }

  rerunTerminal(node: TerminalNode) {
    node.terminal?.dispose();
    node.terminal = window.createTerminal(node.label);
    node.terminal.show(true);
    node.terminal?.sendText(node.command);

    this.updateNodeState(node, State.RUNNING);
  }

  editTerminal(node: TerminalNode) {
    let inputBox = window.createInputBox();
    inputBox.title = "Create Execumate Terminal";
    inputBox.placeholder = "npm run start";
    inputBox.step = 1;
    inputBox.value = node.command ?? "";
    inputBox.totalSteps = 2;
    inputBox.show();

    let command = "";
    let label = "";

    inputBox.onDidAccept(() => {
      if (inputBox.step === 1) {
        command = inputBox.value;
        if (command) {
          inputBox.value = node.label ?? "";
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
        saveCommandsToFile(this.terminals, node.cType, this._context);
      }
    });
  }

  stopTerminal(node: TerminalNode) {
    node.terminal?.dispose();

    this.updateNodeState(node, State.STOPPED);
  }
}
