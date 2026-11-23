import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { userService } from "../services/userService";
import { BackupCodesList } from "./TwoFactorStep";

/** Settings → Security card for admins: 2FA status and new backup codes. */
export default function TwoFactorSettings() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [newCodes, setNewCodes] = useState(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["mfa-status"],
    queryFn: userService.getMfaStatus,
  });

  const regenerate = useMutation({
    mutationFn: () => userService.regenerateBackupCodes(code.trim()),
    onSuccess: (data) => {
      setNewCodes(data.backup_codes);
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
      toast.success("New backup codes created — the old ones no longer work");
    },
    onError: (err) => toast.error(err.message || "Could not create backup codes"),
  });

  const remaining = status?.backup_codes_remaining ?? 0;

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-gray-900">Two-Factor Sign-In</h2>
      </div>

      {isLoading ? (
        <div className="h-12 animate-pulse rounded-lg bg-gray-100" />
      ) : (
        <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 border border-green-100">
          <div>
            <p className="text-sm font-medium text-gray-900">Authenticator app</p>
            <p className={remaining <= 2 ? "text-xs text-amber-700" : "text-xs text-gray-500"}>
              {remaining} backup code{remaining === 1 ? "" : "s"} left
              {remaining <= 2 && " — create new ones below"}
            </p>
          </div>
          <span className="badge bg-green-100 text-green-700 text-xs">
            {status?.enabled ? "On" : "Off"}
          </span>
        </div>
      )}

      {newCodes ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Save these codes now — they will not be shown again.
          </p>
          <BackupCodesList codes={newCodes} />
          <button type="button" onClick={() => setNewCodes(null)} className="btn btn-outline w-full">
            Done
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) regenerate.mutate();
          }}
          className="space-y-2"
        >
          <label className="label" htmlFor="mfa-regen-code">
            New backup codes (replaces the old ones)
          </label>
          <div className="flex gap-2">
            <input
              id="mfa-regen-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input font-mono"
              placeholder="6-digit code from your app"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
            />
            <button
              type="submit"
              disabled={regenerate.isPending || !code.trim()}
              className="btn btn-primary whitespace-nowrap disabled:opacity-50"
            >
              {regenerate.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
              Create codes
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
