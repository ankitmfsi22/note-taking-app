-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "lastVersionNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "NoteVersion" (
    "id" UUID NOT NULL,
    "noteId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NoteVersion_noteId_versionNumber_key" ON "NoteVersion"("noteId", "versionNumber");

-- AddForeignKey
ALTER TABLE "NoteVersion" ADD CONSTRAINT "NoteVersion_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill (SDS 8.4): notes created before versioning get version 1 (including trashed ones,
-- whose versions are kept with the note). gen_random_uuid() is built in since PostgreSQL 13.
INSERT INTO "NoteVersion" ("id", "noteId", "versionNumber", "title", "content", "createdAt")
SELECT gen_random_uuid(), "id", 1, "title", "content", "updatedAt" FROM "Note";

UPDATE "Note" SET "lastVersionNumber" = 1;
