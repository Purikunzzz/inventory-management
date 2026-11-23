import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Copy, Download, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { authService } from "../services/authService";

/** One-time backup codes with copy / download. Shown once — only hashes are stored. */
export function BackupCodesList({ codes }) {
  const text = codes.join("\n");

  function copy() {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Backup codes copied"))
      .catch(() => toast.error("Could not copy — select and copy them manually"));
  }

  function download() {
    const blob = new Blob([`LabFlow backup codes\n\n${text}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "labflow-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 font-mono text-sm text-gray-800">
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={copy} className="btn btn-outline flex-1">
          <Copy className="h-4 w-4" /> Copy
        </button>
        <button type="button" onClick={download} className="btn btn-outline flex-1">
          <Download className="h-4 w-4" /> Download
        </button>
      </div>
    </div>
  );
}

function CodeForm({ onSubmit, pending, backupMode }) {
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) onSubmit(code.trim());
      }}
      className="space-y-3"
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="input text-center font-mono text-lg tracking-widest"
        placeholder={backupMode ? "xxxxx-xxxxx" : "123456"}
        inputMode={backupMode ? "text" : "numeric"}
        autoComplete="one-time-code"
        maxLength={backupMode ? 11 : 6}
        autoFocus
        aria-label={backupMode ? "Backup code" : "Authenticator code"}
      />
      <button type="submit" disabled={pending} className="btn btn-primary w-full disabled:opacity-50">
        {pending && <RefreshCw className="h-4 w-4 animate-spin" />}
        {pending ? "Checking..." : "Continue"}
      </button>
    </form>
  );
}

function SetupStep({ challenge, onDone, onCancel }) {
  const [setup, setSetup] = useState(null);
  const [qr, setQr] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null); // enable response incl. backup_codes
  const [saved, setSaved] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Setup replaces the pending secret, so StrictMode's double effect must not call it twice.
    if (started.current) return;
    started.current = true;
    authService
      .mfaSetup(challenge.mfa_token)
      .then(async (data) => {
        setSetup(data);
        setQr(await QRCode.toDataURL(data.otpauth_uri, { width: 200, margin: 1 }));
      })
      .catch((err) => {
        toast.error(err.message || "Could not start two-factor setup");
        onCancel();
      });
  }, [challenge.mfa_token, onCancel]);

  async function enable(code) {
    setPending(true);
    try {
      setResult(await authService.mfaEnable(challenge.mfa_token, code));
    } catch (err) {
      toast.error(err.message || "Invalid code");
      if (err.status === 401) onCancel();
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Save these backup codes somewhere safe. Each works once if you lose your phone.
          They will not be shown again.
        </p>
        <BackupCodesList codes={result.backup_codes} />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          I have saved my backup codes
        </label>
        <button
          type="button"
          disabled={!saved}
          onClick={() => onDone(result)}
          className="btn btn-primary w-full disabled:opacity-50"
        >
          Finish sign-in
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Admin accounts need two-factor sign-in. Scan this QR code with Google Authenticator,
        Microsoft Authenticator or a similar app, then enter the 6-digit code it shows.
      </p>
      <div className="flex justify-center">
        {qr ? (
          <img src={qr} alt="Two-factor QR code" className="h-48 w-48 rounded-lg border border-gray-100" />
        ) : (
          <div className="h-48 w-48 animate-pulse rounded-lg bg-gray-100" />
        )}
      </div>
      {setup && (
        <p className="text-center text-xs text-gray-500">
          Can't scan? Enter this key: <span className="font-mono break-all text-gray-700">{setup.secret}</span>
        </p>
      )}
      <CodeForm onSubmit={enable} pending={pending || !setup} />
    </div>
  );
}

function VerifyStep({ challenge, onDone, onCancel }) {
  const [backupMode, setBackupMode] = useState(false);
  const [pending, setPending] = useState(false);

  async function verify(code) {
    setPending(true);
    try {
      onDone(await authService.mfaVerify(challenge.mfa_token, code));
    } catch (err) {
      toast.error(err.message || "Invalid code");
      if (err.status === 401) onCancel();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        {backupMode
          ? "Enter one of your backup codes. Each code works only once."
          : "Enter the 6-digit code from your authenticator app."}
      </p>
      <CodeForm key={backupMode ? "backup" : "totp"} onSubmit={verify} pending={pending} backupMode={backupMode} />
      <button
        type="button"
        onClick={() => setBackupMode((v) => !v)}
        className="flex w-full items-center justify-center gap-1 text-xs text-primary-600 hover:underline"
      >
        <KeyRound className="h-3.5 w-3.5" />
        {backupMode ? "Use authenticator app instead" : "Lost your phone? Use a backup code"}
      </button>
    </div>
  );
}

/** Second sign-in step for admins: first-time setup or code entry. */
export default function TwoFactorStep({ challenge, onDone, onCancel }) {
  const Step = challenge.mfa_setup_required ? SetupStep : VerifyStep;
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-gray-900">
          {challenge.mfa_setup_required ? "Set up two-factor sign-in" : "Two-factor sign-in"}
        </h2>
      </div>
      <Step challenge={challenge} onDone={onDone} onCancel={onCancel} />
      <button type="button" onClick={onCancel} className="w-full text-xs text-gray-500 hover:underline">
        Cancel and sign in again
      </button>
    </div>
  );
}
