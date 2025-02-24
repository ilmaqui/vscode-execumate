import { TerminalNodeDTO } from "../dto/terminal-node";
import { TerminalDataProvider } from "../models/terminal-data-provider";
import { TerminalNode } from "../models/terminal-node";

export function mapTerminalNode(
  dto: TerminalNodeDTO,
  provider: TerminalDataProvider
): TerminalNode {
  return new TerminalNode(
    dto.label,
    dto.cType,
    provider,
    dto.children ? mapTerminalNodes(dto.children, provider) : undefined,
    dto.key,
    dto.command,
    dto.variables,
    undefined,
    dto.isGroup
  );
}

export function mapTerminalNodes(
  dtos: TerminalNodeDTO[],
  provider: TerminalDataProvider
): TerminalNode[] {
  return dtos.map((dto) => mapTerminalNode(dto, provider));
}

export function mapTerminalNodeToDTO(node: TerminalNode): TerminalNodeDTO {
  return {
    label: node.label,
    cType: node.cType,
    children: node.children
      ? node.children.map(mapTerminalNodeToDTO)
      : undefined,
    key: node.key,
    iconPath: node.iconPath,
    command: node.terminalCommand,
    variables: node.variables,
    isGroup: node.isGroup,
  } as TerminalNodeDTO;
}

export function mapTerminalNodeToDTOs(nodes: TerminalNode[]) {
  return nodes.map(mapTerminalNodeToDTO);
}
