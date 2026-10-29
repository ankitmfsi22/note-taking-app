import type {
  TipTapDoc,
  VersionDetail,
  VersionListItem,
  VersionListResponse,
} from '@note-app/shared';

export const docOf = (text: string): TipTapDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

export const versionItem = (versionNumber: number): VersionListItem => ({
  versionNumber,
  title: `Title v${versionNumber}`,
  createdAt: new Date(Date.UTC(2026, 9, versionNumber, 10, 0, 0)).toISOString(),
});

export const versionDetail = (versionNumber: number): VersionDetail => ({
  ...versionItem(versionNumber),
  content: docOf(`Content of version ${versionNumber}`),
});

export const versionPage = (
  numbers: number[],
  page = 1,
  totalPages = 1,
  total = numbers.length,
): VersionListResponse => ({
  items: numbers.map(versionItem),
  page,
  pageSize: 20,
  total,
  totalPages,
});
