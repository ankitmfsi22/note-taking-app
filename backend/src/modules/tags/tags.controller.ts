import {
  TagListResponseSchema,
  TagResponseSchema,
  type NoteIdParams,
  type SetNoteTagsRequest,
  type TagCreateRequest,
  type TagIdParams,
  type TagUpdateRequest,
} from '@note-app/shared';
import type { RequestHandler, Response } from 'express';
import { validBody, validParams } from '../../common/http/validate.js';
import { toNoteResponse } from '../notes/notes.controller.js';
import type { TagsService } from './tags.service.js';

type Tag = Awaited<ReturnType<TagsService['create']>>;
type TagList = Awaited<ReturnType<TagsService['list']>>;

// requireAuth runs first on every tags route and always sets it.
const userIdOf = (res: Response): string => String(res.locals.userId);

// Parsing drops userId, nameKey and updatedAt.
const toTagResponse = (tag: Tag) =>
  TagResponseSchema.parse({ ...tag, createdAt: tag.createdAt.toISOString() });

const toListResponse = (tags: TagList) =>
  TagListResponseSchema.parse({
    items: tags.map((tag) => ({ ...tag, createdAt: tag.createdAt.toISOString() })),
  });

export const createTagsController = ({ service }: { service: TagsService }) => ({
  list: (async (_req, res) => {
    res.json(toListResponse(await service.list(userIdOf(res))));
  }) satisfies RequestHandler,

  create: (async (_req, res) => {
    const tag = await service.create(userIdOf(res), validBody<TagCreateRequest>(res));
    res.status(201).json(toTagResponse(tag));
  }) satisfies RequestHandler,

  update: (async (_req, res) => {
    const { tagId } = validParams<TagIdParams>(res);
    const tag = await service.update(userIdOf(res), tagId, validBody<TagUpdateRequest>(res));
    res.json(toTagResponse(tag));
  }) satisfies RequestHandler,

  remove: (async (_req, res) => {
    await service.remove(userIdOf(res), validParams<TagIdParams>(res).tagId);
    res.status(204).end();
  }) satisfies RequestHandler,

  setNoteTags: (async (_req, res) => {
    const { noteId } = validParams<NoteIdParams>(res);
    const { tagIds } = validBody<SetNoteTagsRequest>(res);
    const note = await service.setNoteTags(userIdOf(res), noteId, tagIds);
    res.json(toNoteResponse(note));
  }) satisfies RequestHandler,
});

export type TagsController = ReturnType<typeof createTagsController>;
