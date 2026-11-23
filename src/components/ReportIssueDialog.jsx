import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { maintenanceService } from "../services/maintenanceService";

const MAX_NOTES = 1000;

/** "Report Issue" on ItemDetail: any user describes a problem → scheduled repair job. */
export default function ReportIssueDialog({ item, open, onClose }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");

  const report = useMutation({
    mutationFn: () => maintenanceService.reportIssue(item.id, notes.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "maintenance"] });
      toast.success("Issue reported", {
        description: "A repair job was added to Maintenance for the lab staff.",
      });
      setNotes("");
      onClose();
    },
    onError: (err) => toast.error(err.message || "Could not report the issue"),
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={onClose}
        >
          <motion.form
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (notes.trim()) report.mutate();
            }}
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-elevated space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <h2 className="text-lg font-semibold text-gray-900">Report an issue</h2>
              </div>
              <button type="button" onClick={onClose} className="btn btn-ghost p-1" aria-label="Close">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              What is wrong with <span className="font-medium text-gray-900">{item.name}</span>?
            </p>
            <div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={MAX_NOTES}
                rows={4}
                autoFocus
                className="input resize-none"
                placeholder="e.g. Channel 2 shows no signal; power button sticks"
                aria-label="Describe the issue"
              />
              <p className="mt-1 text-right text-xs text-gray-400">
                {notes.length}/{MAX_NOTES}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn btn-outline">
                Cancel
              </button>
              <button
                type="submit"
                disabled={report.isPending || !notes.trim()}
                className="btn btn-primary disabled:opacity-50"
              >
                {report.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
                Send report
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
