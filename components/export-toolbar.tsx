"use client";

import { useState } from "react";

type ExportToolbarProps = {
  title: string;
  copyText: () => string;
  csvText: () => string;
  fileBase: string;
  shareUrl: () => string;
};

export function ExportToolbar({ title, copyText, csvText, fileBase, shareUrl }: ExportToolbarProps) {
  const [status, setStatus] = useState("");

  const showStatus = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(""), 2200);
  };

  const copy = async () => {
    const copied = await writeToClipboard(copyText());
    showStatus(copied ? "Copied" : "Copy unavailable");
  };

  const share = async () => {
    const url = shareUrl();
    const shareData = { title, text: "Open this StrategyShifu assessment with all inputs restored.", url };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { return; }
    } else {
      const copied = await writeToClipboard(`${title}\n${url}`);
      showStatus(copied ? "Share link copied" : "Share unavailable");
    }
  };

  const downloadCsv = () => {
    showStatus("CSV downloaded");
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csvText())}`;
    link.download = `${fileBase}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="export-toolbar" aria-label="Export actions">
      <button onClick={() => void share()}><ShareIcon /> Share</button>
      <button onClick={() => void copy()}><CopyIcon /> Copy</button>
      <button onClick={downloadCsv}><DownloadIcon /> CSV</button>
      <button onClick={() => window.print()}><PrintIcon /> Print / PDF</button>
      <span aria-live="polite">{status}</span>
    </div>
  );
}

async function writeToClipboard(text: string) {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // The fallback works in local and embedded browser contexts without clipboard permission.
  }

  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  return copied;
}

function ShareIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2.2" /><circle cx="17" cy="6" r="2.2" /><circle cx="17" cy="18" r="2.2" /><path d="m8 11 7-4M8 13l7 4" /></svg>; }
function CopyIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="10" height="11" rx="1" /><path d="M15 8V5H5v11h3" /></svg>; }
function DownloadIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m-4-4 4 4 4-4M5 19h14" /></svg>; }
function PrintIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-5h18v5a2 2 0 0 1-2 2h-2M7 14h10v6H7z" /></svg>; }
