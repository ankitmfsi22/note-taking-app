import {
  NoteListResponseSchema,
  NoteResponseSchema,
  TrashListResponseSchema,
  type NoteCreateRequest,
  type NoteIdParams,
  type NoteListQuery,
  type NoteUpdateRequest,
  type PaginationQuery,
} from '@note-app/shared';
import type { RequestHandler, Response } from 'express';
import { validBody, validParams, validQuery } from '../../common/http/validate.js';
import type { NotesService } from './notes.service.js';

type Note = Awaited<ReturnType<NotesService['get']>>;
type TrashPage = Awaited<ReturnType<NotesService['listTrash']>>;
type NotePage = Awaited<ReturnType<NotesService['list']>>;

// requireAuth runs first on every notes route and always sets it.
const userIdOf = (res: Response): string => String(res.locals.userId);

// Parsing with the shared schema drops userId, contentText and deletedAt from the body.
const toNoteResponse = (note: Note) =>
  NoteResponseSchema.parse({
    id: note.id,
    title: note.title,
    content: note.content,
    tags: [],
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  });

// Parsing drops userId, nameKey and updatedAt from each tag.
const toListResponse = (page: NotePage) =>
  NoteListResponseSchema.parse({
    ...page,
    items: page.items.map((item) => ({
      ...item,
      tags: item.tags.map((tag) => ({ ...tag, createdAt: tag.createdAt.toISOString() })),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  });

const toTrashResponse = (page: TrashPage) =>
  TrashListResponseSchema.parse({
    ...page,
    items: page.items.map((item) => ({
      ...item,
      deletedAt: item.deletedAt.toISOString(),
      purgeAt: item.purgeAt.toISOString(),
    })),
  });

export const createNotesController = ({ service }: { service: NotesService }) => ({
  create: (async (_req, res) => {
    const note = await service.create(userIdOf(res), validBody<NoteCreateRequest>(res));
    res.status(201).json(toNoteResponse(note));
  }) satisfies RequestHandler,

  get: (async (_req, res) => {
    const { noteId } = validParams<NoteIdParams>(res);
    res.json(toNoteResponse(await service.get(userIdOf(res), noteId)));
  }) satisfies RequestHandler,

  update: (async (_req, res) => {
    const { noteId } = validParams<NoteIdParams>(res);
    const note = await service.update(userIdOf(res), noteId, validBody<NoteUpdateRequest>(res));
    res.json(toNoteResponse(note));
  }) satisfies RequestHandler,

  remove: (async (_req, res) => {
    await service.remove(userIdOf(res), validParams<NoteIdParams>(res).noteId);
    res.status(204).end();
  }) satisfies RequestHandler,

  restore: (async (_req, res) => {
    const { noteId } = validParams<NoteIdParams>(res);
    res.json(toNoteResponse(await service.restore(userIdOf(res), noteId)));
  }) satisfies RequestHandler,

  list: (async (_req, res) => {
    const page = await service.list(userIdOf(res), validQuery<NoteListQuery>(res));
    res.json(toListResponse(page));
  }) satisfies RequestHandler,

  listTrash: (async (_req, res) => {
    const page = await service.listTrash(userIdOf(res), validQuery<PaginationQuery>(res));
    res.json(toTrashResponse(page));
  }) satisfies RequestHandler,
});

export type NotesController = ReturnType<typeof createNotesController>;
