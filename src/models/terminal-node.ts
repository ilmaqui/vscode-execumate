import { Terminal, TreeItem, TreeItemCollapsibleState } from "vscode";
import { State } from "./state";
import { CommandType } from "./command-type";
import { TerminalDataProvider } from "./terminal-data-provider";

interface ITerminalNode {
  label: string;
  cType: CommandType;
  provider: TerminalDataProvider;
  children: TerminalNode[] | undefined;
  // order: number;
  terminalCommand?: string;
  variables?: string[];
  state?: State;
  terminal?: Terminal;
  isGroup?: boolean;
}

export class TerminalNode extends TreeItem implements ITerminalNode {
  constructor(
    public label: string,
    public cType: CommandType,
    public provider: TerminalDataProvider,
    public children: TerminalNode[] | undefined,
    // public order: number,
    public state: State = State.STOPPED,
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

    if (children) {
      this.children = children.map(
        (child) =>
          new TerminalNode(
            child.label,
            child.cType,
            child.provider,
            child.children,
            State.STOPPED,
            child.terminalCommand,
            child.variables,
            child.terminal,
            child.isGroup
          )
      );
    }
  }
}
