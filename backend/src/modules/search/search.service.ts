import type { SearchQuery } from '@note-app/shared';
import { randomBytes } from 'node:crypto';
import { anglePlaceholders, escapeHighlight, highlightMarkers } from './escape-highlight.js';
import type { SearchRepository } from './search.repository.js';

// "StartSel" etc. are ts_headline options (SDS 8.2). The delimiter is quoted to keep its spaces.
const optionsFor = (nonce: string, extra: string): string => {
  const { start, stop } = highlightMarkers(nonce);
  return `StartSel=${start}, StopSel=${stop}, ${extra}`;
};

export const createSearchService = ({ repository }: { repository: SearchRepository }) => ({
  search: async (userId: string, { q, page, pageSize }: SearchQuery) => {
    // A fresh nonce per request: a user cannot forge a marker they cannot guess.
    const nonce = randomBytes(8).toString('hex');
    const rows = await repository.searchActiveForUser(userId, {
      q,
      offset: (page - 1) * pageSize,
      limit: pageSize,
      angleOpen: anglePlaceholders(nonce).open,
      angleClose: anglePlaceholders(nonce).close,
      titleOptions: optionsFor(nonce, 'HighlightAll=TRUE'),
      snippetOptions: optionsFor(
        nonce,
        'MaxFragments=2, MaxWords=30, MinWords=10, FragmentDelimiter=" … "',
      ),
    });

    const first = rows[0];
    const total = first ? Number(first.total) : await repository.countActiveForUser(userId, q);
    const tags = await repository.findTagsForNotes(
      userId,
      rows.map((row) => row.id),
    );
    const matched = rows.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt,
      titleHighlight: escapeHighlight(row.titleHl, nonce),
      snippet: escapeHighlight(row.snippetHl, nonce),
      tags: tags.get(row.id) ?? [],
    }));

    return { items: matched, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  },
});

export type SearchService = ReturnType<typeof createSearchService>;
