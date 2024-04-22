import * as fs from "fs/promises";
import { TerminalDataProvider } from "./models/terminal-data-provider";
import { CommandType } from "./models/command-type";
import vscode from "vscode";
import { State } from "./models/state";
import path from "path";

export async function readCommandsFromFile(filePath: string): Promise<any[]> {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to read commands from file:", error);
    return [];
  }
}

export async function loadCommandsFromFile(
  provider: TerminalDataProvider,
  cType: CommandType
) {
  const fileName =
    cType === CommandType.GLOBAL
      ? "global-execumate.json"
      : "workspace-execumate.json";
  const folderPath =
    cType === CommandType.GLOBAL
      ? vscode.extensions.all[0].extensionPath
      : vscode.workspace.workspaceFolders?.[0].uri.fsPath;

  if (folderPath) {
    const filePath = path.join(folderPath, fileName);
    const commands = await readCommandsFromFile(filePath);
    commands.forEach((item) =>
      provider.addTerminalNode(
        item.command,
        State.STOPPED,
        item.label,
        cType,
        provider
      )
    );
  }
}
