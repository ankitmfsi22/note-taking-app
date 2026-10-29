import { parseHighlight } from '../highlight';

// Segments are React text nodes; only a segment the server marked is wrapped in <mark>.
export function HighlightedText({ text }: { text: string }) {
  return (
    <>
      {parseHighlight(text).map((segment, index) =>
        segment.highlighted ? (
          <mark
            key={index}
            className="rounded-sm bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/40"
          >
            {segment.text}
          </mark>
        ) : (
          segment.text
        ),
      )}
    </>
  );
}
