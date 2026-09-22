import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  GitCommit,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  User,
  Plus,
  Trash2,
  Layers,
  ArrowRight,
  Flame,
} from "lucide-react";
import {
  dependencyService,
  type DependencyGraphNode,
  type DependencyGraphEdge,
  type DependencyGraphResponse,
} from "../../services/dependencyService";
import { Button, Modal } from "../ui";
import { cn } from "../../lib/utils";

interface DependencyGraphProps {
  projectId: string;
  className?: string;
  onTaskSelect?: (taskId: string) => void;
}

const STATUS_COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  TODO: { dot: "bg-slate-400", text: "text-slate-300", bg: "bg-slate-500/10" },
  IN_PROGRESS: { dot: "bg-blue-400 animate-pulse", text: "text-blue-300", bg: "bg-blue-500/10" },
  IN_REVIEW: { dot: "bg-purple-400", text: "text-purple-300", bg: "bg-purple-500/10" },
  COMPLETED: { dot: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-500/10" },
  BLOCKED: { dot: "bg-rose-400 animate-pulse", text: "text-rose-300", bg: "bg-rose-500/10" },
};

const PRIORITY_BADGES: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: "Crit", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
  HIGH: { label: "High", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  MEDIUM: { label: "Med", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
  LOW: { label: "Low", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
};

const NODE_WIDTH = 230;
const NODE_HEIGHT = 92;
const COL_GAP = 120;
const ROW_GAP = 36;

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  projectId,
  className,
  onTaskSelect,
}) => {
  const [graphData, setGraphData] = useState<DependencyGraphResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Layout node positions
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  // Canvas Pan & Zoom State
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Node Dragging
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Selected Node Drawer / Modal
  const [selectedNode, setSelectedNode] = useState<DependencyGraphNode | null>(null);
  const [isAddPrereqOpen, setIsAddPrereqOpen] = useState(false);
  const [newPrereqId, setNewPrereqId] = useState("");
  const [mutationError, setMutationError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Fetch graph data
  const loadGraph = async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await dependencyService.getDependencyGraph(projectId);
      setGraphData(data);
      computeAutoLayout(data.nodes);
    } catch (err: any) {
      console.error("Failed to load dependency graph:", err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.detail ||
          "Failed to load project dependency graph."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, [projectId]);

  // Compute topological column auto-layout
  const computeAutoLayout = (nodes: DependencyGraphNode[]) => {
    // Group by level
    const tiers: Record<number, DependencyGraphNode[]> = {};
    nodes.forEach((n) => {
      const lvl = n.level || 0;
      if (!tiers[lvl]) tiers[lvl] = [];
      tiers[lvl].push(n);
    });

    const positions: Record<string, { x: number; y: number }> = {};
    Object.keys(tiers).forEach((lvlStr) => {
      const lvl = parseInt(lvlStr, 10);
      const tierNodes = tiers[lvl];
      tierNodes.forEach((n, idx) => {
        const x = lvl * (NODE_WIDTH + COL_GAP) + 40;
        const y = idx * (NODE_HEIGHT + ROW_GAP) + 40;
        positions[n.id] = { x, y };
      });
    });

    setNodePositions(positions);
  };

  // Zoom controls
  const handleZoom = (delta: number) => {
    setScale((prev) => Math.min(Math.max(0.4, prev + delta), 2.0));
  };

  const handleResetView = () => {
    setScale(1);
    setPan({ x: 40, y: 40 });
    if (graphData) {
      computeAutoLayout(graphData.nodes);
    }
  };

  // Canvas Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === "svg") {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    } else if (draggingNodeId) {
      setNodePositions((prev) => ({
        ...prev,
        [draggingNodeId]: {
          x: (e.clientX - dragOffset.x - pan.x) / scale,
          y: (e.clientY - dragOffset.y - pan.y) / scale,
        },
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Node Drag Handlers
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggingNodeId(nodeId);
    const currPos = nodePositions[nodeId] || { x: 0, y: 0 };
    setDragOffset({
      x: e.clientX - (currPos.x * scale + pan.x),
      y: e.clientY - (currPos.y * scale + pan.y),
    });
  };

  // Add dependency
  const handleAddDependency = async () => {
    if (!selectedNode || !newPrereqId) return;
    setMutationError(null);
    try {
      await dependencyService.addDependency(selectedNode.id, newPrereqId);
      setIsAddPrereqOpen(false);
      setNewPrereqId("");
      await loadGraph();
    } catch (err: any) {
      console.error("Failed to add dependency:", err);
      setMutationError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.detail ||
          "Failed to add dependency relationship."
      );
    }
  };

  // Remove dependency
  const handleRemoveDependency = async (prereqId: string) => {
    if (!selectedNode) return;
    setMutationError(null);
    try {
      await dependencyService.removeDependency(selectedNode.id, prereqId);
      setSelectedNode((prev) =>
        prev
          ? {
              ...prev,
              dependencies: prev.dependencies.filter((d) => d !== prereqId),
            }
          : null
      );
      await loadGraph();
    } catch (err: any) {
      console.error("Failed to remove dependency:", err);
      setMutationError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.detail ||
          "Failed to remove dependency."
      );
    }
  };

  const criticalPathSet = useMemo(() => {
    return new Set(graphData?.critical_path_task_ids || []);
  }, [graphData]);

  // Generate cubic bezier curve for directed edge
  const renderEdge = (edge: DependencyGraphEdge) => {
    const src = nodePositions[edge.source];
    const tgt = nodePositions[edge.target];
    if (!src || !tgt) return null;

    const startX = src.x + NODE_WIDTH;
    const startY = src.y + NODE_HEIGHT / 2;
    const endX = tgt.x;
    const endY = tgt.y + NODE_HEIGHT / 2;

    const dx = Math.max(40, (endX - startX) * 0.5);
    const pathData = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

    const isCritical = edge.is_critical_path;

    return (
      <g key={edge.id}>
        {/* Glow halo for critical path */}
        {isCritical && (
          <path
            d={pathData}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={6}
            strokeOpacity={0.25}
            strokeLinecap="round"
          />
        )}
        <path
          d={pathData}
          fill="none"
          stroke={isCritical ? "#f59e0b" : "#475569"}
          strokeWidth={isCritical ? 2.5 : 1.5}
          strokeDasharray={isCritical ? "6 3" : undefined}
          strokeOpacity={isCritical ? 1 : 0.6}
          markerEnd={isCritical ? "url(#arrow-critical)" : "url(#arrow-normal)"}
          className={cn(isCritical && "animate-pulse")}
        />
      </g>
    );
  };

  return (
    <div
      className={cn(
        "relative w-full h-[620px] rounded-3xl glass-panel border border-white/10 overflow-hidden select-none flex flex-col bg-slate-950/60",
        className
      )}
    >
      {/* Top Controls Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 shadow-lg pointer-events-auto">
          <GitCommit className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold text-white tracking-tight">
            Topological DAG Visualizer
          </span>
          {graphData && (
            <span className="text-[11px] font-mono text-slate-400 border-l border-white/10 pl-2">
              {graphData.nodes.length} Nodes • {graphData.edges.length} Edges
            </span>
          )}
        </div>

        {/* Critical Path Indicator & Zoom Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {graphData && graphData.critical_path_task_ids.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl text-amber-300 text-xs font-mono font-medium shadow-glow-amber">
              <Flame className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
              <span>Critical Path: {graphData.critical_path_length} Days</span>
              <span className="text-amber-400/70">
                ({graphData.critical_path_task_ids.length} Tasks)
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-lg">
            <button
              type="button"
              onClick={() => handleZoom(0.15)}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(-0.15)}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleResetView}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Reset View"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={cn(
          "w-full h-full cursor-grab active:cursor-grabbing relative overflow-hidden",
          isLoading && "opacity-50 pointer-events-none"
        )}
      >
        {error && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {/* SVG Arrowhead Markers & Edges Layer */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          <defs>
            <marker
              id="arrow-normal"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b" />
            </marker>
            <marker
              id="arrow-critical"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" />
            </marker>
          </defs>

          {/* Render All Edges */}
          {graphData?.edges.map(renderEdge)}
        </svg>

        {/* HTML Task Node Cards Layer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          {graphData?.nodes.map((node) => {
            const pos = nodePositions[node.id] || { x: 0, y: 0 };
            const isCritical = criticalPathSet.has(node.id);
            const statusStyle = STATUS_COLORS[node.status] || STATUS_COLORS.TODO;
            const priorityBadge = PRIORITY_BADGES[node.priority] || PRIORITY_BADGES.MEDIUM;

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={() => {
                  setSelectedNode(node);
                  if (onTaskSelect) onTaskSelect(node.id);
                }}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT,
                }}
                className={cn(
                  "absolute pointer-events-auto cursor-pointer rounded-2xl p-3 glass-card border transition-all select-none shadow-xl flex flex-col justify-between group",
                  isCritical
                    ? "border-amber-500/50 bg-amber-950/20 hover:border-amber-400 hover:shadow-glow-amber"
                    : "border-white/10 hover:border-cyan-500/40 bg-slate-900/80 hover:shadow-glow-cyan"
                )}
              >
                {/* Header: Status Dot + Priority + Critical Path Badge */}
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", statusStyle.dot)} />
                    <span className={cn("font-medium truncate", statusStyle.text)}>
                      {node.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 font-mono">
                    {isCritical && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-0.5">
                        <Flame className="h-2.5 w-2.5" />
                        CPM
                      </span>
                    )}
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded font-semibold border",
                        priorityBadge.color
                      )}
                    >
                      {priorityBadge.label}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h4
                  className="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition-colors leading-tight"
                  title={node.title}
                >
                  {node.title}
                </h4>

                {/* Footer: Assignee + Level Horizon */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-white/5 pt-1.5">
                  <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                    {node.assignee_avatar ? (
                      <img
                        src={node.assignee_avatar}
                        alt="Avatar"
                        className="h-4 w-4 rounded-full border border-white/20"
                      />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-slate-300">
                        {node.assignee_name ? node.assignee_name.charAt(0) : <User className="h-2.5 w-2.5" />}
                      </div>
                    )}
                    <span className="truncate">{node.assignee_name || "Unassigned"}</span>
                  </div>

                  <span className="font-mono text-slate-500 shrink-0">
                    Lvl {node.level} • {node.duration_days}d
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Legend */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-4 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 text-[11px] text-slate-400 pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 bg-slate-500 rounded" />
          <span>Prerequisite Edge</span>
        </div>
        <div className="flex items-center gap-1.5 text-amber-400">
          <div className="h-0.5 w-4 bg-amber-400 border-dashed border-t-2 border-amber-400" />
          <span className="font-medium">Critical Path (CPM)</span>
        </div>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">Click node to manage prerequisites</span>
      </div>

      {/* Task Dependency Inspector Modal */}
      <Modal
        isOpen={Boolean(selectedNode)}
        onClose={() => {
          setSelectedNode(null);
          setIsAddPrereqOpen(false);
          setMutationError(null);
        }}
        size="md"
        title={
          selectedNode && (
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-cyan-400" />
              <span className="truncate">Task Dependencies: {selectedNode.title}</span>
            </div>
          )
        }
        description="Inspect prerequisites and manage dependency chain integrity."
      >
        {selectedNode && (
          <div className="space-y-4 text-xs">
            {/* Mutation Alert */}
            {mutationError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{mutationError}</span>
              </div>
            )}

            {/* Task Info Summary */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400">Workflow Status</span>
                <p className="text-sm font-semibold text-white mt-0.5">{selectedNode.status}</p>
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Priority Level</span>
                <p className="text-sm font-semibold text-white mt-0.5">{selectedNode.priority}</p>
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Topological Depth</span>
                <p className="text-sm font-semibold text-cyan-400 font-mono mt-0.5">
                  Tier {selectedNode.level}
                </p>
              </div>
            </div>

            {/* Current Prerequisites List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                  Prerequisites Must Complete First ({selectedNode.dependencies.length})
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddPrereqOpen(true)}
                  className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 text-[11px]"
                >
                  <Plus className="h-3 w-3" />
                  Add Prerequisite
                </button>
              </div>

              {selectedNode.dependencies.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center text-slate-400">
                  This task has no prerequisites. It can be started immediately.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedNode.dependencies.map((prereqId) => {
                    const prereqNode = graphData?.nodes.find((n) => n.id === prereqId);
                    return (
                      <div
                        key={prereqId}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-white/10"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ArrowRight className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                          <span className="text-white font-medium truncate">
                            {prereqNode ? prereqNode.title : `Task ${prereqId}`}
                          </span>
                          {prereqNode && (
                            <span
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded font-mono",
                                prereqNode.status === "COMPLETED"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-amber-500/10 text-amber-400"
                              )}
                            >
                              {prereqNode.status}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveDependency(prereqId)}
                          className="p-1 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Unlink prerequisite"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add Prerequisite Form */}
            {isAddPrereqOpen && (
              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-3">
                <label className="text-xs font-semibold text-cyan-300">
                  Select Prerequisite Task (Cycle-Validated)
                </label>
                <select
                  value={newPrereqId}
                  onChange={(e) => setNewPrereqId(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  <option value="">Select a prerequisite task...</option>
                  {graphData?.nodes
                    .filter(
                      (n) =>
                        n.id !== selectedNode.id &&
                        !selectedNode.dependencies.includes(n.id)
                    )
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title} ({n.status})
                      </option>
                    ))}
                </select>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddPrereqOpen(false)}
                    className="text-slate-400 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAddDependency}
                    disabled={!newPrereqId}
                    className="text-xs"
                  >
                    Link Prerequisite
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
