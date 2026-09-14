import type { Note } from "@platform/db";
import { addNoteAction } from "@/app/a/[tenantId]/staff/shared-actions";
import { formatDate } from "@/lib/format";

export function NotesPanel({
  notes,
  tenantId,
  contactId,
  dealId,
}: {
  notes: Note[];
  tenantId: string;
  contactId?: string;
  dealId?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-medium">Notes</h2>
      <form action={addNoteAction} className="flex flex-col gap-2">
        <input type="hidden" name="tenantId" value={tenantId} />
        {contactId && <input type="hidden" name="contactId" value={contactId} />}
        {dealId && <input type="hidden" name="dealId" value={dealId} />}
        <textarea
          name="body"
          required
          rows={2}
          placeholder="Add a note..."
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="self-start rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          Add note
        </button>
      </form>
      <ul className="flex flex-col gap-2">
        {notes.map((note) => (
          <li key={note.id} className="rounded-md bg-slate-50 p-2 text-sm">
            <p>{note.body}</p>
            <p className="text-xs text-slate-400">{formatDate(note.createdAt)}</p>
          </li>
        ))}
        {notes.length === 0 && <p className="text-sm text-slate-500">No notes yet.</p>}
      </ul>
    </div>
  );
}
