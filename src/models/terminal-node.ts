import { Terminal, TreeItem, TreeItemCollapsibleState } from "vscode";
import { State } from "./state";
import { CommandType } from "./command-type";
import { TerminalDataProvider } from "./terminal-data-provider";
import { generateKey } from "../generate-key";

export class TerminalNode extends TreeItem {
  public state: State = State.STOPPED;
  constructor(
    public label: string,
    public cType: CommandType,
    public provider: TerminalDataProvider,
    public children: TerminalNode[] | undefined,
    public key: string | undefined,
    public terminalCommand?: string,
    public variables?: string[],
    public terminal?: Terminal,
    public isGroup?: boolean
  ) {
    super(
      label,
      children === undefined || children.length === 0
        ? TreeItemCollapsibleState.None
        : TreeItemCollapsibleState.Collapsed // Ensure subgroups are always closed
    );
    if (!key) {
      this.key = generateKey();
    }

    if (children) {
      this.recursiveGenerateKey(undefined, children);
    }
  }

  private recursiveGenerateKey(
    node: TerminalNode | undefined,
    tree?: TerminalNode[]
  ) {
    const currentNode = tree ?? node?.children ?? [];
    for (const n of currentNode) {
      n.key = n.key ?? generateKey();
      if (n.children) {
        this.recursiveGenerateKey(n, n.children);
      }
    }
  }

  toJSON(): any {
    const { provider, terminal, children, ...rest } = this;
    return {
      ...rest,
      children: children
        ? children.map((child) =>
            typeof child.toJSON === "function" ? child.toJSON() : child
          )
        : undefined,
    };
  }
}
