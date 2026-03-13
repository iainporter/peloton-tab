"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { joinGroup } from "../actions";

export default function JoinGroupPage() {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await joinGroup(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">Join a Group</h1>

      <form action={handleSubmit} className="space-y-4">
        <Input
          name="code"
          label="Invite Code"
          placeholder="e.g. ABC123"
          required
          autoFocus
          className="uppercase tracking-widest text-center text-lg"
          maxLength={6}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full">
          Join Group
        </Button>
      </form>
    </div>
  );
}
