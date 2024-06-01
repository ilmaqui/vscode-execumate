import { QuickPickItem } from "vscode";

export interface QuickPickVariables extends QuickPickItem {
  code?: string;
}
