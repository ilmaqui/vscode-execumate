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
  TreeItemCollapsibleState,
} from "vscode";
import { TerminalNode } from "./terminal-node";
import { State } from "./state";
import { CommandType } from "./command-type";
import { saveCommandsToFile } from "../file-operations";
import { QuickPickVariables } from "./quickpick-variables";
import { InputBoxFlow } from "./input-box-flow";

export class TerminalDataProvider
  implements
    TreeDataProvider<TerminalNode>,
    TreeDragAndDropController<TerminalNode>
{
  private _onDidChangeTreeData: EventEmitter<
    (TerminalNode | undefined)[] | undefined
  > = new EventEmitter<TerminalNode[] | undefined>();

  readonly onDidChangeTreeData: Event<any> = this._onDidChangeTreeData.event;

  public terminals: TerminalNode[] = [];
  public cType: CommandType;
  private _context: ExtensionContext;

  constructor(context: ExtensionContext, cType: CommandType) {
    this.cType = cType;
    this._context = context;
  }
  dropMimeTypes = ["application/vnd.code.tree.execumate.global"];
  dragMimeTypes = [
    "text/uri-list",
    "application/vnd.code.tree.execumate.global",
  ];

  // Add this helper to recursively find a node by key.
  private findNodeByKey(
    key: string,
    tree: TerminalNode[] = this.terminals
  ): TerminalNode | undefined {
    for (const node of tree) {
      if (node.key === key) {
        return node;
      }
      if (node.children) {
        const found = this.findNodeByKey(key, node.children);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }

  handleDrag(
    source: readonly TerminalNode[],
    dataTransfer: DataTransfer,
    token: CancellationToken
  ): Thenable<void> | void {
    // Instead of passing the object directly, serialize an array of node keys.
    const keys = source.map((node) => node.key);
    const serialized = JSON.stringify(keys);
    // Set the custom mime type as well as a fallback mime type.
    dataTransfer.set(
      "application/vnd.code.tree.execumate.global",
      new DataTransferItem(serialized)
    );
    dataTransfer.set("text/uri-list", new DataTransferItem(serialized));
  }

  handleDrop(
    target: TerminalNode | undefined,
    dataTransfer: DataTransfer,
    token: CancellationToken
  ): Thenable<void> | void {
    const transferItem = dataTransfer.get(
      "application/vnd.code.tree.execumate.global"
    );
    if (!transferItem) {
      return;
    }
    // Parse the serialized keys from the drag event.
    let draggedKeys: string[];
    try {
      draggedKeys = JSON.parse(transferItem.value);
    } catch (e) {
      return;
    }
    // Retrieve the actual dragged nodes using their keys.
    const draggedNodes: TerminalNode[] = draggedKeys
      .map((key) => this.findNodeByKey(key))
      .filter((node): node is TerminalNode => !!node);

    // Get the top-level nodes among the dragged items.
    let roots = this.getLocalRoots(draggedNodes);
    // Filter out if the target is already a descendant.
    roots = roots.filter((r) => !this.isChild(r, target));
    if (roots.length > 0) {
      const parents = roots.map((r) => this.getParent(r));
      roots.forEach((r) => this.reparentNode(r, target));

      this.saveTerminals(!target?.isGroup ? undefined : [...parents, target]);
    }
  }

  private isChild(
    node: TerminalNode,
    potentialChild: TerminalNode | undefined
  ): boolean {
    if (!potentialChild) {
      return false;
    }
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        if (child.key === potentialChild.key) {
          return true;
        }
        // Recursively check within each child
        if (this.isChild(child, potentialChild)) {
          return true;
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
        const isInList = nodes.find((n) => n.key === parent.key);
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
    // Remove the node from its current location.
    this.removeNode(node);

    if (target) {
      if (target.isGroup) {
        // If target is a group, add as a child.
        if (!target.children) {
          target.children = [];
        }
        target.children.push(node);
      } else {
        // If target is not a group, insert the node as a sibling below the target.
        const parent = this.getParent(target);
        let siblings: TerminalNode[];
        if (parent) {
          siblings = parent.children!;
        } else {
          siblings = this.terminals;
        }
        // Find the index of the target among its siblings.
        const targetIndex = siblings.findIndex((n) => n.key === target.key);
        // Insert the node immediately after the target.
        siblings.splice(targetIndex + 1, 0, node);
      }
    } else {
      // No target means dropping at the root level.
      this.terminals.push(node);
    }
  }

  private removeNode(element: TerminalNode, tree?: TerminalNode[]): boolean {
    const list = tree ?? this.terminals;
    for (let i = 0; i < list.length; i++) {
      if (list[i].key === element.key) {
        list.splice(i, 1);
        return true;
      } else {
        const children = list[i].children; // Capture children in a variable.
        if (children && children.length > 0) {
          if (this.removeNode(element, children)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  getParent(
    element: TerminalNode,
    parent?: TerminalNode,
    tree?: TerminalNode[]
  ): TerminalNode | undefined {
    const currentNode = tree ?? this.terminals;
    for (const node of currentNode) {
      if (node.key === element.key && parent) {
        return parent;
      } else {
        const foundParent = this.getParent(element, node, node.children ?? []);
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
      arguments: [element],
      title: "Show Terminal",
    };
  }

  private getCollapsibleState(element: TerminalNode): TreeItemCollapsibleState {
    return element.children && element.children.length > 0
      ? TreeItemCollapsibleState.Collapsed
      : TreeItemCollapsibleState.None;
  }

  getTreeItem(element: TerminalNode): TreeItem {
    element.iconPath = new ThemeIcon(
      element.isGroup ? "folder" : this.getIconForState(element.state)
    );

    element.contextValue = this.getContextValue(element);
    element.description = this.getDescription(element);
    element.command = this.getCommand(element);
    element.collapsibleState = this.getCollapsibleState(element);

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

  createGroup(cType: CommandType, parent?: TerminalNode) {
    new InputBoxFlow("Create Execumate Group", "Group Name", 1, ([label]) => {
      if (label) {
        const terminalNode = new TerminalNode(
          label,
          cType,
          this,
          [],
          undefined,
          undefined,
          undefined,
          undefined,
          true
        );

        this.addTerminalNode(terminalNode, parent);
      }
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

          const terminalNode = new TerminalNode(
            label ?? command,
            cType,
            this,
            undefined,
            undefined,
            command,
            variables,
            undefined,
            false
          );

          this.addTerminalNode(terminalNode, parent);
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
    const index = this.terminals.findIndex(
      (node) => node.terminal === closedTerminal
    );
    if (index !== -1) {
      this.terminals[index].state = State.STOPPED;
      this.terminals[index].terminal = undefined;
      this._onDidChangeTreeData.fire([this.terminals[index]]);
      return index;
    }
    return -1;
  }

  addTerminals(terminals: TerminalNode[]) {
    this.terminals = terminals;
    this._onDidChangeTreeData.fire(undefined);
  }

  addTerminalNode(node: TerminalNode, parent?: TerminalNode) {
    if (parent) {
      parent?.children?.push(node);
    } else {
      this.terminals.push(node);
    }

    this.saveTerminals([node, parent]);
    return node;
  }

  deleteTerminal(node: TerminalNode) {
    node.terminal?.dispose();
    this.removeNode(node);

    this.saveTerminals(undefined);
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
          this.handleVariableSaveCommand(node, command);
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

  /**
   *
   * @param node
   * @param command
   */
  handleVariableSaveCommand(node: TerminalNode, command: string) {
    const terminalNode = new TerminalNode(
      node.label,
      node.cType,
      node.provider,
      undefined,
      undefined,
      command,
      undefined,
      undefined,
      node.isGroup
    );

    this.addTerminalNode(terminalNode, this.getParent(node));
    this.runCommandInTerminal(terminalNode, command);
  }

  /**
   * Runs the node command in the terminal
   * @param node the node associated with the command
   * @param command the command to be run
   * @returns
   */
  runCommandInTerminal(node: TerminalNode, command: string | undefined) {
    if (!command) {
      return;
    }

    node.terminal = window.createTerminal(node.label);
    node.terminal.show(true);
    node.terminal.sendText(command);
    this.updateNodeState(node, State.RUNNING);
  }

  /**
   * Updates the state of the node
   * @param node the node to be updated
   * @param state the state to update the node to
   */
  updateNodeState(node: TerminalNode, state: State) {
    node.state = state;
    this._onDidChangeTreeData.fire([node]);
  }

  /**
   * Reruns the terminal associated with the node
   * @param node the node to be rerun
   */
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
    if (node.isGroup) {
      this.editGroup(node);
      return;
    }

    const flow = new InputBoxFlow(
      "Edit Execumate Terminal",
      node.terminalCommand ?? "",
      3,
      ([command, label, variablesRaw]) => {
        if (command) {
          const variables = variablesRaw
            ? variablesRaw.split(",").map((v) => v.trim())
            : [];
          // Update node values from the flow responses:
          node.terminalCommand = command;
          node.label = label || command;
          node.variables = variables;
          // Save the updated node:
          this.saveTerminals([node]);
        }
      },
      node.terminalCommand
    );

    // Add the second step (label) with pre-populated value:
    flow.addStep(
      "A cool label",
      "Enter a label associated with the command: (optional)",
      node.label
    );

    // Add the third step (variables) with pre-populated value:
    flow.addStep(
      "--port 3000,--port 3001,--open",
      "Enter any optional variables this command can have separated by commas: (optional)",
      node.variables?.join(",")
    );
  }

  editGroup(node: TerminalNode) {
    new InputBoxFlow("Edit Execumate Group", node.label, 1, ([label]) => {
      if (label) {
        node.label = label;
        this.saveTerminals([node]);
      }
    });
  }

  /**
   * Saves the current state of the terminals to the file
   * @param data The data that is subject to change (undefined if all data is subject to change)
   */
  private saveTerminals(data: (TerminalNode | undefined)[] | undefined) {
    this._onDidChangeTreeData.fire(data);
    saveCommandsToFile(this.cType, this.terminals, this._context);
  }

  /**
   * Stops the terminal associated with the node
   * @param node The node to stop
   */
  stopTerminal(node: TerminalNode) {
    node.terminal?.dispose();
    this.updateNodeState(node, State.STOPPED);
  }
}
