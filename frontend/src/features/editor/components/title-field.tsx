import { Input } from '@/components/ui/input';

interface TitleFieldProps {
  value: string;
  error?: string | undefined;
  onChange: (value: string) => void;
}

export function TitleField({ value, error, onChange }: TitleFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <Input
        aria-label="Title"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'note-title-error' : undefined}
        className="h-11 text-xl font-semibold"
        placeholder="Untitled"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p id="note-title-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
