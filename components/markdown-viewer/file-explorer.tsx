"use client";

import { useState } from "react";
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";

import type { MarkdownFileNode } from "@/lib/markdown-files";
import { cn } from "@/lib/utils";

type FileNode = Extract<MarkdownFileNode, { type: "file" }>;

interface FileExplorerProps {
  nodes: MarkdownFileNode[];
  selectedPath: string | null;
  onSelectFile: (node: FileNode) => void;
  disabled?: boolean;
}

export function FileExplorer({ nodes, selectedPath, onSelectFile, disabled }: FileExplorerProps) {
  if (nodes.length === 0) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">docs 폴더에 마크다운 파일이 없습니다.</p>;
  }

  return (
    <div className="py-1">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function FileTreeNode({
  node,
  depth,
  selectedPath,
  onSelectFile,
  disabled,
}: {
  node: MarkdownFileNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (node: FileNode) => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const indent = { paddingLeft: `${depth * 14 + 12}px` };

  if (node.type === "folder") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={indent}
          className="flex w-full items-center gap-1.5 py-1.5 pr-2 text-sm text-foreground hover:bg-muted/60"
        >
          <ChevronRight
            className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")}
          />
          {expanded ? (
            <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && (
          <div>
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
                disabled={disabled}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;

  return (
    <button
      type="button"
      onClick={() => onSelectFile(node)}
      disabled={disabled}
      style={indent}
      className={cn(
        "flex w-full items-center gap-1.5 py-1.5 pr-2 text-sm hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60",
        isSelected ? "bg-accent text-accent-foreground" : "text-foreground"
      )}
    >
      <File className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
