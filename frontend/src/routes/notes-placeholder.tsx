import { SearchSection } from '@/features/search/components/search-section';

// Stands in for the notes list until AB-1011; the search box mounts above it (AB-1013).
export function Component() {
  return (
    <SearchSection>
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Your notes</h2>
        <p className="text-muted-foreground">No notes to show yet.</p>
      </section>
    </SearchSection>
  );
}
