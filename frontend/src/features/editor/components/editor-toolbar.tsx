import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ToolButtonProps {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolButton({ label, icon: Icon, active = false, disabled, onClick }: ToolButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // Keeps the text selection in the editor while the button is pressed.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon />
    </Button>
  );
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function LinkControl({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onOpenChange = (next: boolean) => {
    if (next) {
      setHref((editor.getAttributes('link') as { href?: string }).href ?? '');
      setError(null);
    }
    setOpen(next);
  };

  const apply = (event: FormEvent) => {
    event.preventDefault();
    const value = href.trim();
    const target = HAS_SCHEME.test(value) ? value : `https://${value}`;
    if (!value || !editor.chain().focus().setLink({ href: target }).run()) {
      setError('Enter an http, https or mailto address');
      return;
    }
    setOpen(false);
  };

  const remove = () => {
    editor.chain().focus().unsetLink().run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={active ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-label="Link"
          title="Link"
          aria-pressed={active}
          onMouseDown={(event) => event.preventDefault()}
        >
          <LinkIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <form className="flex flex-col gap-2" onSubmit={apply}>
          <Input
            aria-label="Link address"
            placeholder="https://example.com"
            value={href}
            onChange={(event) => setHref(event.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" aria-label="Apply link">
              Apply
            </Button>
            {active && (
              <Button type="button" size="sm" variant="outline" onClick={remove}>
                Remove link
              </Button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      h1: current.isActive('heading', { level: 1 }),
      h2: current.isActive('heading', { level: 2 }),
      h3: current.isActive('heading', { level: 3 }),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      strike: current.isActive('strike'),
      bullet: current.isActive('bulletList'),
      ordered: current.isActive('orderedList'),
      quote: current.isActive('blockquote'),
      code: current.isActive('code'),
      codeBlock: current.isActive('codeBlock'),
      link: current.isActive('link'),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const run = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1">
      <ToolButton
        label="Heading 1"
        icon={Heading1}
        active={state.h1}
        onClick={() => run().toggleHeading({ level: 1 }).run()}
      />
      <ToolButton
        label="Heading 2"
        icon={Heading2}
        active={state.h2}
        onClick={() => run().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        label="Heading 3"
        icon={Heading3}
        active={state.h3}
        onClick={() => run().toggleHeading({ level: 3 }).run()}
      />
      <ToolButton
        label="Bold"
        icon={Bold}
        active={state.bold}
        onClick={() => run().toggleBold().run()}
      />
      <ToolButton
        label="Italic"
        icon={Italic}
        active={state.italic}
        onClick={() => run().toggleItalic().run()}
      />
      <ToolButton
        label="Strikethrough"
        icon={Strikethrough}
        active={state.strike}
        onClick={() => run().toggleStrike().run()}
      />
      <ToolButton
        label="Bullet list"
        icon={List}
        active={state.bullet}
        onClick={() => run().toggleBulletList().run()}
      />
      <ToolButton
        label="Numbered list"
        icon={ListOrdered}
        active={state.ordered}
        onClick={() => run().toggleOrderedList().run()}
      />
      <ToolButton
        label="Quote"
        icon={Quote}
        active={state.quote}
        onClick={() => run().toggleBlockquote().run()}
      />
      <ToolButton
        label="Code"
        icon={Code}
        active={state.code}
        onClick={() => run().toggleCode().run()}
      />
      <ToolButton
        label="Code block"
        icon={SquareCode}
        active={state.codeBlock}
        onClick={() => run().toggleCodeBlock().run()}
      />
      <LinkControl editor={editor} active={state.link} />
      <ToolButton
        label="Undo"
        icon={Undo2}
        disabled={!state.canUndo}
        onClick={() => run().undo().run()}
      />
      <ToolButton
        label="Redo"
        icon={Redo2}
        disabled={!state.canRedo}
        onClick={() => run().redo().run()}
      />
    </div>
  );
}
