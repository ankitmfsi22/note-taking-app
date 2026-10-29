import type { TagResponse } from '@note-app/shared';
import { Badge } from '@/components/ui/badge';

// The colour was validated as #RRGGBB by the shared schema when the response was parsed.
export function TagBadge({ tag }: { tag: Pick<TagResponse, 'name' | 'color'> }) {
  return (
    <Badge variant="outline">
      <span
        aria-hidden="true"
        className="inline-block size-2 rounded-full"
        style={{ backgroundColor: tag.color }}
      />
      {tag.name}
    </Badge>
  );
}
