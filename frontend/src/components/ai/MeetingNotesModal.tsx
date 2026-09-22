import React, { useState } from "react";
import {
  FileText,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertCircle,
  Plus,
  Zap,
} from "lucide-react";
import {
  aiService,
  type MeetingActionItem,
  type MeetingNotesResponse,
} from "../../services/aiService";
import { Button, Modal } from "../ui";
import { cn } from "../../lib/utils";

interface MeetingNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  onTasksAdded?: () => void;
}

export const MeetingNotesModal: React.FC<MeetingNotesModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onTasksAdded,
}) => {
  const [rawText, setRawText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<MeetingNotesResponse | null>(null);
  const [selectedTaskIndices, setSelectedTaskIndices] = useState<Set<number>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleExtract = async () => {
    if (!rawText.trim()) {
      setError("Please paste meeting notes or upload a text file.");
      return;
    }

    setError(null);
    setIsExtracting(true);
    try {
      const res = await aiService.convertMeetingNotes({
        raw_text: rawText.trim(),
        project_id: projectId,
      });
      setExtractedData(res);
      // Select all action items by default
      setSelectedTaskIndices(new Set(res.action_items.map((_, i) => i)));
    } catch (err: any) {
      console.error("Meeting notes extraction failed:", err);
      setError(err?.response?.data?.error?.message || "Failed to extract tasks from notes.");
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleTaskSelection = (index: number) => {
    setSelectedTaskIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleBatchCommit = async () => {
    if (!projectId) {
      setError("Please select a target project first.");
      return;
    }
    if (!extractedData) return;

    const selectedTasks = extractedData.action_items.filter((_, i) => selectedTaskIndices.has(i));
    if (selectedTasks.length === 0) {
      setError("Please select at least one action item to create.");
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      await aiService.applyPlan({
        project_id: projectId,
        tasks: selectedTasks.map((t) => ({
          title: t.title,
          description: t.description,
          priority: t.priority,
          tags: t.tags,
        })),
      });

      setSuccessMessage(`Successfully committed ${selectedTasks.length} action items to your board!`);
      setTimeout(() => {
        setSuccessMessage(null);
        setExtractedData(null);
        setRawText("");
        onTasksAdded?.();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("Failed to batch add tasks:", err);
      setError(err?.response?.data?.error?.message || "Failed to batch add tasks.");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-400" />
          Meeting Notes & Transcript to Tasks
        </span>
      }
      description="Paste meeting notes or transcripts. TaskPilot AI will parse key decisions and generate structured task backlog items."
      className="max-w-4xl"
    >
      <div className="space-y-4 pt-2">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Dual-Pane Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Pane: Raw Notes Input */}
          <div className="space-y-3 flex flex-col">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold uppercase tracking-wider">Raw Meeting Notes</span>
              <label className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload .txt/.md</span>
                <input
                  type="file"
                  accept=".txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              rows={14}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw transcript, minutes, or notes here...&#10;&#10;e.g.&#10;Sprint Standup 10/24:&#10;- Agreed to refactor auth tokens to RS256&#10;- Alice will write the migration script by Thursday&#10;- Bob reported MongoDB query latency issues on /tasks..."
              className="w-full flex-1 rounded-2xl bg-slate-950/80 p-3.5 text-xs text-white glass-input focus:outline-none placeholder:text-slate-500 resize-none"
            />

            <Button
              variant="primary"
              size="sm"
              glow
              isLoading={isExtracting}
              onClick={handleExtract}
              leftIcon={<Zap className="h-4 w-4 text-cyan-300" />}
              className="w-full justify-center"
            >
              Parse Notes & Extract Tasks
            </Button>
          </div>

          {/* Right Pane: Parsed Output */}
          <div className="space-y-3 flex flex-col">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold uppercase tracking-wider">Extracted Action Items</span>
              {extractedData && (
                <span className="text-indigo-400 font-mono">
                  {selectedTaskIndices.size} of {extractedData.action_items.length} selected
                </span>
              )}
            </div>

            <div className="flex-1 max-h-[380px] overflow-y-auto rounded-2xl glass-card p-4 border border-white/10 space-y-4">
              {!extractedData ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-500">
                  <Sparkles className="h-8 w-8 text-slate-600" />
                  <p className="text-xs">
                    Paste notes on the left and click &quot;Parse Notes&quot; to preview extracted action items and decisions.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Box */}
                  <div className="space-y-1 pb-3 border-b border-white/10">
                    <h4 className="text-sm font-bold text-white">{extractedData.meeting_title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {extractedData.summary}
                    </p>
                  </div>

                  {/* Key Decisions */}
                  {extractedData.key_decisions.length > 0 && (
                    <div className="space-y-1.5 pb-3 border-b border-white/10">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                        Agreed Decisions:
                      </span>
                      {extractedData.key_decisions.map((dec, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{dec}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Items List */}
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Draft Tasks:
                    </span>

                    {extractedData.action_items.map((item: MeetingActionItem, idx: number) => {
                      const isSelected = selectedTaskIndices.has(idx);

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "rounded-xl p-3 border text-xs space-y-1 transition-all",
                            isSelected
                              ? "bg-slate-900/70 border-indigo-500/30"
                              : "bg-slate-950/20 border-white/5 opacity-50"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleTaskSelection(idx)}
                                className="h-3.5 w-3.5 rounded bg-slate-800 border-white/20 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <span className="font-semibold text-white truncate">
                                {item.title}
                              </span>
                            </div>

                            <span
                              className={cn(
                                "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border",
                                item.priority === "CRITICAL"
                                  ? "text-rose-400 border-rose-500/30 bg-rose-500/10"
                                  : item.priority === "HIGH"
                                  ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                                  : "text-indigo-400 border-indigo-500/30 bg-indigo-500/10"
                              )}
                            >
                              {item.priority}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 pl-5">{item.description}</p>

                          {item.suggested_assignee && (
                            <div className="pl-5 text-[10px] text-slate-500">
                              Suggested: <span className="text-slate-300">{item.suggested_assignee}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {extractedData && (
              <Button
                variant="primary"
                size="sm"
                glow
                isLoading={isApplying}
                onClick={handleBatchCommit}
                leftIcon={<Plus className="h-4 w-4" />}
                className="w-full justify-center"
              >
                Batch Add Selected Tasks to Project
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
