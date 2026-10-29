// Stands in for the notes list until AB-1011.
export function Component() {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">Your notes</h2>
      <p className="text-muted-foreground">No notes to show yet.</p>
    </section>
  );
}
