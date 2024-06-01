import { Terminal } from "vscode";
import { State } from "./state";
import { CommandType } from "./command-type";
import { TerminalDataProvider } from "./terminal-data-provider";
interface ITerminalNode {
  label: string;
  command: string;
  state: State;
  cType: CommandType;
  provider: TerminalDataProvider;
  terminal?: Terminal;
}

export class TerminalNode implements ITerminalNode {
  constructor(
    public label: string,
    public command: string,
    public state: State,
    public cType: CommandType,
    public provider: TerminalDataProvider,
    public variables: string[],
    public terminal?: Terminal
  ) {}
}
