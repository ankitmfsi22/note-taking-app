-- AlterTable: generated column, hand-edited because Prisma cannot express it (SDS 6.4).
-- Title is weight A, the first 250,000 characters of contentText weight B.
ALTER TABLE "Note" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', left(coalesce("contentText", ''), 250000)), 'B')
  ) STORED;

-- CreateIndex
CREATE INDEX "Note_searchVector_idx" ON "Note" USING GIN ("searchVector");
