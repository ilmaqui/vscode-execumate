import {
  TreeDataProvider,
  EventEmitter,
  Event,
  ThemeIcon,
  ProviderResult,
  window,
  Terminal,
  Command,
  TreeItem,
  ExtensionContext,
  QuickPickItemKind,
  TreeDragAndDropController,
  CancellationToken,
  DataTransfer,
  DataTransferItem,
} from "vscode";
import { TerminalNode } from "./terminal-node";
import { State } from "./state";
import { CommandType } from "./command-type";
import { saveCommandToJson, saveCommandsToFile } from "../fileOperations";
import { QuickPickVariables } from "./quickpick-variables";
import { InputBoxFlow } from "./input-box-flow";

export class TerminalDataProvider
  implements
    TreeDataProvider<TerminalNode>,
    TreeDragAndDropController<TerminalNode>
{
  private _onDidChangeTreeData: EventEmitter<TerminalNode | undefined> =
    new EventEmitter<TerminalNode | undefined>();

  readonly onDidChangeTreeData: Event<TerminalNode | undefined> =
    this._onDidChangeTreeData.event;

  public terminals: TerminalNode[] = [];
  private _context: ExtensionContext;

  constructor(context: ExtensionContext) {
    this._context = context;
  }
  dropMimeTypes = ["application/vnd.code.tree.execumate.global"];
  dragMimeTypes = [
    "application/vnd.code.tree.execumate.global",
    "text/uri-list",
  ];

  handleDrag(
    source: readonly TerminalNode[],
    dataTransfer: DataTransfer,
    token: CancellationToken
  ): Thenable<void> | void {
    console.log(source, dataTransfer);

    dataTransfer.set(
      "application/vnd.code.tree.execumate.global",
      new DataTransferItem(source)
    );
  }

  handleDrop(
    target: TerminalNode | undefined,
    dataTransfer: DataTransfer,
    token: CancellationToken
  ): Thenable<void> | void {
    if (target && !target?.isGroup) {
      return;
    }

    const transferItem = dataTransfer.get(
      "application/vnd.code.tree.execumate.global"
    );
    if (!transferItem) {
      return;
    }
    const draggedNodes: TerminalNode[] = transferItem.value;
    let roots = this.getLocalRoots(draggedNodes);
    roots = roots.filter((r) => !this.isChild(this.getTreeElement(r), target));
    if (roots.length > 0) {
      const parents = roots.map((r) => this.getParent(r));
      roots.forEach((r) => this.reparentNode(r, target));
      parents.forEach((parent) => this._onDidChangeTreeData.fire(parent));
      this._onDidChangeTreeData.fire(target);
    }
  }

  private isChild(
    node: TerminalNode,
    child: TerminalNode | undefined
  ): boolean {
    if (!child) {
      return false;
    }
    if (node.children && node.children.length > 0) {
      for (let prop = 0; prop < node.children.length; prop++) {
        if (node.children[prop] === child) {
          return true;
        } else {
          const isChild = this.isChild(node.children[prop], child);
          if (isChild) {
            return isChild;
          }
        }
      }
    }
    return false;
  }

  private getLocalRoots(nodes: TerminalNode[]): TerminalNode[] {
    const localRoots = [];
    for (const node of nodes) {
      const parent = this.getParent(node);
      if (parent) {
        const isInList = nodes.find((n) => n === parent);
        if (isInList === undefined) {
          localRoots.push(node);
        }
      } else {
        localRoots.push(node);
      }
    }
    return localRoots;
  }

  private reparentNode(
    node: TerminalNode,
    target: TerminalNode | undefined
  ): void {
    const element = this.getTreeElement(node);
    this.removeNode(node);
    const targetElement = this.getTreeElement(target);
    if (!targetElement.children) {
      targetElement.children = [];
    }
    targetElement.children.push(node);
  }

  private removeNode(element: TerminalNode, tree?: TerminalNode[]): void {
    const subTree = tree ? tree : this.terminals;
    for (const prop in subTree) {
      if (subTree[prop] === element) {
        const parent = this.getParent(element);
        const parentObject = this.getTreeElement(parent);
        if (parent && parentObject.children) {
          parentObject.children = parentObject.children.filter(
            (child) => child !== element
          );
        } else {
          this.terminals = this.terminals.filter((t) => t !== element);
        }
      } else {
        this.removeNode(element, subTree[prop].children);
      }
    }
  }

  private getTreeElement(
    element: TerminalNode | undefined,
    tree?: TerminalNode[]
  ): TerminalNode {
    if (!element) {
      return this.terminals[0];
    }
    const currentNode = tree ?? this.terminals;
    for (const prop in currentNode) {
      if (currentNode[prop] === element) {
        return currentNode[prop];
      } else {
        const treeElement = this.getTreeElement(
          element,
          currentNode[prop].children
        );
        if (treeElement) {
          return treeElement;
        }
      }
    }
    return this.terminals[0];
  }

  getParent(
    element: TerminalNode,
    parent?: TerminalNode,
    tree?: TerminalNode[]
  ): TerminalNode | undefined {
    const currentNode = tree ?? this.terminals;
    for (const prop in currentNode) {
      if (currentNode[prop] === element && parent) {
        return parent;
      } else {
        const foundParent = this.getParent(
          element,
          currentNode[prop],
          currentNode[prop].children
        );
        if (foundParent) {
          return foundParent;
        }
      }
    }
    return undefined;
  }

  private getIconForState(state: State | undefined): string {
    switch (state) {
      case State.RUNNING:
        return "terminal";
      case State.STOPPED:
        return "debug-disconnect";
      default:
        return "error";
    }
  }

  private getContextValue(element: TerminalNode): string {
    if (element.isGroup) {
      return "terminalNodeGroup";
    }

    return element.state !== undefined
      ? `terminalNode-${State[element.state]}`
      : `terminalNode-${element.label}`;
  }

  private getDescription(element: TerminalNode): string {
    return element.label === element.terminalCommand
      ? ""
      : element.terminalCommand ?? "";
  }

  private getCommand(element: TerminalNode): Command {
    return {
      command: "execumate.showTerminal",
      arguments: [element, this],
      title: "Show Terminal",
    };
  }

  getTreeItem(element: TerminalNode): TreeItem {
    element.iconPath = new ThemeIcon(
      element.isGroup ? "folder" : this.getIconForState(element.state)
    );

    element.contextValue = this.getContextValue(element);
    element.description = this.getDescription(element);
    element.command = this.getCommand(element);

    return element;
  }

  getChildren(element?: TerminalNode): ProviderResult<TerminalNode[]> {
    if (element === undefined) {
      return this.terminals;
    }
    return element.children || [];
  }

  getQuickPickCommandTypes(): QuickPickVariables[] {
    return [
      ...Object.keys(CommandType).map((key) => ({
        label: key,
        code: CommandType[key as keyof typeof CommandType],
      })),
    ];
  }

  createGroup(ctype: CommandType) {
    let inputBox = window.createInputBox();
    inputBox.title = "Create a group";
    inputBox.placeholder = "Group name";
    inputBox.step = 1;
    inputBox.show();

    let groupName = "";
    inputBox.onDidAccept(() => {
      groupName = inputBox.value;
    });
  }

  createTerminal(cType: CommandType, parent?: TerminalNode) {
    const flow = new InputBoxFlow(
      "Create Execumate Terminal",
      "npm run start",
      3,
      ([command, label, variablesRaw]) => {
        if (command) {
          const variables = variablesRaw
            ? variablesRaw.split(",").map((v) => v.trim())
            : [];

          this.addTerminalNode(
            label,
            cType,
            this,
            command,
            variables,
            State.STOPPED
          );

          const isGlobal = cType === CommandType.GLOBAL;
          saveCommandToJson(command, label, isGlobal, this._context, variables);
        }
      }
    );

    flow.addStep(
      "A cool label",
      "Enter a label associated with the command: (optional)"
    );
    flow.addStep(
      "--port 3000,--port 3001,--open",
      "Enter any optional variables this command can have separated by commas: (optional)"
    );
  }

  handleTerminalClose(closedTerminal: Terminal) {
    const nodeIndex = this.terminals.findIndex(
      (node) => node.terminal === closedTerminal
    );
    if (nodeIndex !== -1) {
      this.terminals[nodeIndex].state = State.STOPPED;
      this.terminals[nodeIndex].terminal = undefined;
      this._onDidChangeTreeData.fire(this.terminals[nodeIndex]);
      return nodeIndex;
    }
    return -1;
  }

  addTerminalNode(
    label: string,
    cType: CommandType,
    provider: TerminalDataProvider,
    command?: string,
    variables?: string[],
    state?: State,
    children?: TerminalNode[] | undefined,
    isGroup?: boolean
  ) {
    const terminalNode = new TerminalNode(
      label ?? command,
      cType,
      provider,
      children,
      state,
      command,
      variables,
      undefined,
      isGroup
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
    if (!node.terminalCommand) {
      return;
    }

    let command = node.terminalCommand;
    if (node.variables && node.variables.length > 0) {
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
    if (!node.variables) {
      return [];
    }
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
      "",
      node.cType,
      node.provider,
      command,
      undefined,
      State.STOPPED
    );

    const isGlobal = node.cType === CommandType.GLOBAL;
    saveCommandToJson(command, "", isGlobal, this._context, []);

    this.runCommandInTerminal(terminalNode, command);
  }

  runCommandInTerminal(node: TerminalNode, command: string | undefined) {
    if (!command) {
      return;
    }

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
    if (!node.terminalCommand) {
      return;
    }

    node.terminal?.dispose();
    node.terminal = window.createTerminal(node.label);
    node.terminal.show(true);
    node.terminal?.sendText(node.terminalCommand);

    this.updateNodeState(node, State.RUNNING);
  }

  editTerminal(node: TerminalNode) {
    let inputBox = window.createInputBox();
    inputBox.title = "Create Execumate Terminal";
    inputBox.placeholder = "npm run start";
    inputBox.step = 1;
    inputBox.value = node.terminalCommand ?? "";
    inputBox.totalSteps = 3;
    inputBox.show();

    let command = "";
    let label = "";
    let variables = [];

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
        inputBox.value = node.variables ? node.variables.join(", ") : "";
        inputBox.step = 3;
        inputBox.prompt =
          "Enter any optional variables this command can have separated by commas: (optional) ";
        inputBox.placeholder = "--port 3000,--port 3001,--open";
      } else if (inputBox.step === 3) {
        variables = inputBox.value === "" ? [] : inputBox.value.split(",");
        inputBox.value = "";
        inputBox.hide();
        node.label = label ?? command;
        node.terminalCommand = command;
        node.variables = variables;
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
