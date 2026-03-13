import { Button, Input } from "@/components/ui";
import { createGroup } from "../actions";

export default function NewGroupPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">Create a Group</h1>

      <form action={createGroup} className="space-y-4">
        <Input
          name="name"
          label="Group Name"
          placeholder="e.g. Tuesday Coffee Riders"
          required
          autoFocus
        />
        <Button type="submit" className="w-full">
          Create Group
        </Button>
      </form>
    </div>
  );
}
