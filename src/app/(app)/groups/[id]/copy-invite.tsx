"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function CopyInviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const shareUrl = `${window.location.origin}/join/${code}`;

    if (navigator.share) {
      try {
        await navigator.share({
          text: `Join my cycling group on PelotonTab! Use code: ${code}\n${shareUrl}`,
        });
        return;
      } catch {
        // User cancelled or share not supported — fall through to copy
      }
    }

    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="secondary" onClick={handleCopy} className="text-xs">
      {copied ? "Copied!" : "Share"}
    </Button>
  );
}
