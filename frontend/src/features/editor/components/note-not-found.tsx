import { Link } from 'react-router';

// Missing, deleted and other users' notes all look the same: the API answers 404 for each.
export function NoteNotFound() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-2xl font-semibold">Note not found</h1>
      <p className="text-muted-foreground">
        This note does not exist, was deleted, or is not available to you.
      </p>
      <Link to="/notes" className="text-primary underline">
        Back to your notes
      </Link>
    </div>
  );
}
