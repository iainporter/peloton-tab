"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";

/**
 * A form for server actions that return `{ error }` on validation failure.
 * Shows the error inline instead of Next's error page, keeps what the user
 * typed (React resets forms after a `<form action>` completes), and disables
 * the fields while submitting. Redirects from the action still navigate.
 */
export function ActionForm({
  action,
  className = "",
  children,
}: {
  action: (formData: FormData) => Promise<{ error: string } | undefined>;
  className?: string;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={isPending} className={`min-w-0 ${className}`}>
        {children}
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </fieldset>
    </form>
  );
}
