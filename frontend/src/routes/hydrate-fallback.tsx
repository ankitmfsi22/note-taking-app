// Shown while React Router loads the lazy route that matches the first URL.
export function HydrateFallback() {
  return (
    <p role="status" className="p-6">
      Loading…
    </p>
  );
}
