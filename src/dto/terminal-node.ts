import { ThemeIcon } from "vscode";
import { CommandType } from "../models/command-type";

export interface TerminalNodeDTO {
  label: string;
  cType: CommandType;
  children: TerminalNodeDTO[] | undefined;
  key: string;
  iconPath: ThemeIcon;
  command?: string;
  variables?: string[];
  isGroup?: boolean;
}
