import * as fsP from "fs/promises";
import fs from "fs";
import { TerminalDataProvider } from "./models/terminal-data-provider";
import { CommandType } from "./models/command-type";
import vscode from "vscode";
import path from "path";
import { TerminalNode } from "./models/terminal-node";
import {
  mapTerminalNodes,
  mapTerminalNodeToDTOs,
} from "./mappers/terminal-node";
import { TerminalNodeDTO } from "./dto/terminal-node";

export async function createExtensionFolder(
  context: vscode.ExtensionContext
): Promise<void> {
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

export async function readCommandsFromFile(
  filePath: string
): Promise<TerminalNodeDTO[]> {
  try {
    const data = await fsP.readFile(filePath, "utf8");
    return JSON.parse(data) as TerminalNodeDTO[];
  } catch (error) {
    console.error("Failed to read commands from file:", error);
    return [];
  }
}

export async function saveCommandsToFile(
  cType: CommandType,
  terminals: TerminalNode[],
  context: vscode.ExtensionContext
): Promise<void> {
  const isGlobal = cType === CommandType.GLOBAL;
  const fileName = isGlobal
    ? "global-execumate.json"
    : "workspace-execumate.json";
  const folderPath = isGlobal
    ? context.globalStorageUri.fsPath
    : vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0].uri.fsPath;
  if (folderPath) {
    const filePath = path.join(folderPath, fileName);

    const dtos = mapTerminalNodeToDTOs(terminals);
    fs.writeFileSync(filePath, JSON.stringify(dtos));
  }
}

export async function loadCommandsFromFile(
  provider: TerminalDataProvider,
  cType: CommandType,
  context: vscode.ExtensionContext
) {
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
    const terminalNodeDTOs = await readCommandsFromFile(filePath);

    const terminals = mapTerminalNodes(terminalNodeDTOs, provider);
    provider.addTerminals(terminals);
  }
}
