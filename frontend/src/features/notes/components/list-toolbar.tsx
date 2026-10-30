import { LIST_TAG_IDS_MAX, type TagWithCount } from '@note-app/shared';
import { Label } from '@/components/ui/label';
import type { ListParams, SortBy, SortOrder } from '../list-params';

const SORT_FIELDS: { value: SortBy; label: string }[] = [
  { value: 'updatedAt', label: 'Last updated' },
  { value: 'createdAt', label: 'Created' },
  { value: 'title', label: 'Title' },
];

const SORT_ORDERS: { value: SortOrder; label: string }[] = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
];

const SELECT_CLASS =
  'h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

interface ListToolbarProps {
  params: ListParams;
  tags: TagWithCount[];
  tagsLoading?: boolean;
  onChange: (next: Partial<Pick<ListParams, 'sortBy' | 'sortOrder' | 'tagIds'>>) => void;
}

export function ListToolbar({ params, tags, tagsLoading = false, onChange }: ListToolbarProps) {
  const toggleTag = (tagId: string) =>
    onChange({
      tagIds: params.tagIds.includes(tagId)
        ? params.tagIds.filter((id) => id !== tagId)
        : [...params.tagIds, tagId],
    });
  const atLimit = params.tagIds.length >= LIST_TAG_IDS_MAX;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="sort-by">Sort by</Label>
          <select
            id="sort-by"
            className={SELECT_CLASS}
            value={params.sortBy}
            onChange={(event) => onChange({ sortBy: event.target.value as SortBy })}
          >
            {SORT_FIELDS.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="sort-order">Order</Label>
          <select
            id="sort-order"
            className={SELECT_CLASS}
            value={params.sortOrder}
            onChange={(event) => onChange({ sortOrder: event.target.value as SortOrder })}
          >
            {SORT_ORDERS.map((order) => (
              <option key={order.value} value={order.value}>
                {order.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* The row keeps its height while the tags load, so the list below does not move. */}
      {tagsLoading && <div aria-hidden="true" className="h-6" />}
      {tags.length > 0 && (
        <div
          className="flex min-h-6 flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter by tag"
        >
          {tags.map((tag) => {
            const selected = params.tagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                aria-pressed={selected}
                disabled={!selected && atLimit}
                onClick={() => toggleTag(tag.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 ${
                  selected ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
