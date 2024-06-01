import * as fsP from "fs/promises";
import fs from "fs";
import { TerminalDataProvider } from "./models/terminal-data-provider";
import { CommandType } from "./models/command-type";
import vscode from "vscode";
import { State } from "./models/state";
import path from "path";
import { TerminalNode } from "./models/terminal-node";

export async function createExtensionFolder(context: vscode.ExtensionContext) {
  const folderPath = context.globalStorageUri.fsPath;
  const filePath = path.join(folderPath, "global-execumate.json");
  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "[]");
    }
  } catch (error) {
    console.error("Failed to create extension folder:", error);
  }
}

export async function readCommandsFromFile(filePath: string): Promise<any[]> {
  try {
    const data = await fsP.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to read commands from file:", error);
    return [];
  }
}

export async function saveCommandToJson(
  command: string,
  label: string,
  isGlobal: boolean,
  context: vscode.ExtensionContext,
  variables: string[]
) {
  const fileName = isGlobal
    ? "global-execumate.json"
    : "workspace-execumate.json";
  const folderPath = isGlobal
    ? context.globalStorageUri.fsPath
    : vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0].uri.fsPath;
  if (folderPath) {
    const filePath = path.join(folderPath, fileName);

    let commands = [];
    if (fs.existsSync(filePath)) {
      commands = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    commands.push({ label, command, variables });
    fs.writeFileSync(filePath, JSON.stringify(commands));
  }
}

export async function saveCommandsToFile(
  terminals: TerminalNode[],
  cType: CommandType,
  context: vscode.ExtensionContext
) {
  if (cType !== CommandType.TEMPORARY) {
    const isGlobal = cType === CommandType.GLOBAL;
    const filteredTerminals = terminals.filter((c) => c.cType === cType);
    const fileName = isGlobal
      ? "global-execumate.json"
      : "workspace-execumate.json";
    const folderPath = isGlobal
      ? context.globalStorageUri.fsPath
      : vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (folderPath) {
      const filePath = path.join(folderPath, fileName);
      const mappedCommands = filteredTerminals.map((t) => ({
        command: t.command,
        label: t.label,
        variables: t.variables,
      }));
      fs.writeFileSync(filePath, JSON.stringify(mappedCommands));
    }
  }
}

export async function loadCommandsFromFile(
  provider: TerminalDataProvider,
  cType: CommandType,
  context: vscode.ExtensionContext
) {
  if (cType !== CommandType.TEMPORARY) {
    const fileName =
      cType === CommandType.GLOBAL
        ? "global-execumate.json"
        : "workspace-execumate.json";
    const folderPath =
      cType === CommandType.GLOBAL
        ? context.globalStorageUri.fsPath
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
          provider,
          item.variables ?? []
        )
      );
    }
  }
}
