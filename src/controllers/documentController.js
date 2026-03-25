import * as documentService from '../services/documentService.js';
import { paginationParams, paginatedResponse } from '../utils/pagination.js';

export async function list(req, res, next) {
  try {
    const { page, limit, offset } = paginationParams(req.query);
    const { category, search } = req.query;

    const { rows, total } = await documentService.getDocuments(
      req.params.projectId,
      { page, limit, offset, category, search }
    );

    res.json(paginatedResponse(rows, total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const doc = await documentService.getDocumentById(req.params.projectId, req.params.docId);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(doc);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const doc = await documentService.createDocument(req.params.projectId, req.user.id, req.body);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const doc = await documentService.updateDocument(
      req.params.projectId, req.params.docId, req.user.id, req.body
    );

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(doc);
  } catch (err) {
    next(err);
  }
}

export async function duplicate(req, res, next) {
  try {
    const doc = await documentService.duplicateDocument(
      req.params.projectId, req.params.docId, req.user.id
    );

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await documentService.deleteDocument(
      req.params.projectId, req.params.docId, req.user.id
    );

    if (!result) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
