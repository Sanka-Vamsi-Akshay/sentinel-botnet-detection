
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, LoaderCircle, RefreshCw } from "lucide-react";

import API_BASE_URL from "../api";

const HEALTH_URL = `${API_BASE_URL}/api/health`;

export default function BackendStatus() {
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Checking backend connection...");

  const checkBackend = useCallback(async () => {
    setStatus("checking");
    setMessage("Checking backend connection...");

    try {
      const response = await fetch(HEALTH_URL);

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== "healthy") {
        throw new Error("Backend responded, but is not reporting healthy.");
      }

      setStatus("online");
      setMessage("Backend connected");
    } catch (error) {
      setStatus("offline");
      setMessage(error.message || "Could not connect to backend");
    }
  }, []);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  const isOnline = status === "online";
  const isChecking = status === "checking";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          isChecking
            ? "animate-pulse bg-amber-400"
            : isOnline
            ? "bg-emerald-400"
            : "bg-rose-400"
        }`}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">
          {isChecking ? "Checking API" : isOnline ? "API Online" : "API Offline"}
        </p>
        <p className="text-xs text-slate-400">{message}</p>
      </div>

      <button
        type="button"
        onClick={checkBackend}
        disabled={isChecking}
        aria-label="Check backend connection again"
        className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
      >
        {isChecking ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : status === "offline" ? (
          <RefreshCw className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
      </button>

      {status === "offline" && (
        <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
      )}
    </div>
  );
}