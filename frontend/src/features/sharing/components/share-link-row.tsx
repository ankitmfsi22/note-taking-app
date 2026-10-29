import type { ShareLinkResponse } from '@note-app/shared';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { shareUrl } from '../share-utils';
import { RevokeLinkButton } from './revoke-link-button';

const formatDate = (iso: string) => new Date(iso).toLocaleString();

interface ShareLinkRowProps {
  link: ShareLinkResponse;
  noteTitle?: string;
  onError: (message: string) => void;
}

export function ShareLinkRow({ link, noteTitle, onError }: ShareLinkRowProps) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(link.token));
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopy('idle'), 2000);
  };

  const active = link.status === 'active';
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      {noteTitle && <span className="font-medium">{noteTitle}</span>}
      {active && <code className="break-all">{shareUrl(link.token)}</code>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
        <span className="rounded bg-muted px-2 py-0.5 text-foreground">{link.status}</span>
        <span>Expires: {link.expiresAt ? formatDate(link.expiresAt) : 'Never'}</span>
        <span>Views: {link.viewCount}</span>
      </div>
      {active && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void onCopy()}>
            Copy
          </Button>
          <RevokeLinkButton shareId={link.id} onError={onError} />
          <span role="status" className="text-muted-foreground">
            {copy === 'copied' && 'Copied'}
            {copy === 'failed' && 'Could not copy'}
          </span>
        </div>
      )}
    </li>
  );
}
