import * as fsP from "fs/promises";
import fs from "fs";
import { TerminalDataProvider } from "./models/terminal-data-provider";
import { CommandType } from "./models/command-type";
import vscode from "vscode";
import { State } from "./models/state";
import path from "path";
import { TerminalNode } from "./models/terminal-node";

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
): Promise<TerminalNode[]> {
  try {
    const data = await fsP.readFile(filePath, "utf8");
    return JSON.parse(data) as TerminalNode[];
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
): Promise<void> {
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

export async function saveGroupToJson(
  label: string,
  isGlobal: boolean,
  context: vscode.ExtensionContext
): Promise<void> {
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
    commands.push({ label });
    fs.writeFileSync(filePath, JSON.stringify(commands));
  }
}

export async function saveCommandsToFile(
  terminals: TerminalNode[],
  cType: CommandType,
  context: vscode.ExtensionContext
) {
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
      command: t.terminalCommand,
      label: t.label,
      variables: t.variables,
      children: t.children ? t.children : null,
    }));
    fs.writeFileSync(filePath, JSON.stringify(mappedCommands));
  }
}

function initializeChildrenWithState(
  children: TerminalNode[] | undefined,
  provider: TerminalDataProvider,
  cType: CommandType
): TerminalNode[] | undefined {
  if (!children) {
    return undefined;
  }

  return children.map((child) => {
    const newChild = new TerminalNode(
      child.label,
      cType,
      provider,
      initializeChildrenWithState(child.children, provider, cType),
      State.STOPPED,
      child.terminalCommand,
      child.variables,
      child.terminal,
      child.isGroup
    );
    return newChild;
  });
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
    const commands = await readCommandsFromFile(filePath);
    for (const cmd of commands) {
      provider.addTerminalNode(
        cmd.label,
        cType,
        provider,
        cmd.terminalCommand,
        cmd.variables ?? undefined,
        State.STOPPED,
        initializeChildrenWithState(cmd.children, provider, cType),
        cmd.isGroup
      );
    }
  }
}
