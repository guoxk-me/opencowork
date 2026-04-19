import React from 'react';
import { TaskArtifact } from '../../core/task/types';

interface ArtifactViewerProps {
  artifact: TaskArtifact;
  onOpenArtifact?: (uri: string) => void;
  onCopy?: (value: string) => void;
}

function renderTable(artifact: TaskArtifact) {
  const columns = Array.isArray(artifact.metadata?.columns)
    ? (artifact.metadata?.columns as string[])
    : [];
  const rows = Array.isArray(artifact.metadata?.rows)
    ? (artifact.metadata?.rows as Array<Record<string, unknown>>)
    : [];

  if (columns.length === 0 || rows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded border border-border bg-surface">
      <table className="min-w-full text-left text-xs text-text-secondary">
        <thead className="bg-background/70 text-text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border/70">
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 align-top whitespace-pre-wrap text-white">
                  {row[column] === undefined || row[column] === null ? '' : String(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ArtifactViewer({ artifact, onOpenArtifact, onCopy }: ArtifactViewerProps) {
  const canOpen = !!artifact.uri && !!onOpenArtifact;
  const copyValue = artifact.uri || artifact.content || '';
  const canCopy = !!copyValue && !!onCopy;

  return (
    <div className="rounded-lg border border-border bg-background px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-white">
            {artifact.type}: {artifact.name}
          </div>
          {artifact.uri && <div className="mt-1 break-all text-xs text-text-muted">{artifact.uri}</div>}
        </div>
        <div className="flex items-center gap-2">
          {canOpen && (
            <button
              onClick={() => onOpenArtifact?.(artifact.uri as string)}
              className="rounded px-2 py-1 text-xs text-text-muted hover:bg-border hover:text-white"
            >
              Open
            </button>
          )}
          {canCopy && (
            <button
              onClick={() => onCopy?.(copyValue)}
              className="rounded px-2 py-1 text-xs text-text-muted hover:bg-border hover:text-white"
            >
              Copy
            </button>
          )}
        </div>
      </div>

      {artifact.type === 'table' && renderTable(artifact)}

      {artifact.type !== 'table' && artifact.content && (
        <div className="mt-3 whitespace-pre-wrap text-xs text-text-secondary">{artifact.content}</div>
      )}
    </div>
  );
}

export default ArtifactViewer;
