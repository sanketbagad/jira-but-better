import * as documentService from '../services/documentService.js';
import * as aiDocumentService from '../services/aiDocumentService.js';
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

export async function generateWithAI(req, res, next) {
  try {
    const result = await aiDocumentService.generateDocumentDraft(req.params.projectId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createWithAI(req, res, next) {
  try {
    const result = await aiDocumentService.createDocumentWithAI(
      req.params.projectId,
      req.user.id,
      req.body
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function analyzeWithAI(req, res, next) {
  try {
    if (req.body.docId) {
      const result = await aiDocumentService.analyzeExistingDocument(
        req.params.projectId,
        req.body.docId,
        req.body
      );

      if (!result) {
        return res.status(404).json({ error: 'Document not found' });
      }

      return res.json(result);
    }

    const result = await aiDocumentService.analyzeDocument(req.params.projectId, req.body);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getSuggestions(req, res, next) {
  try {
    const result = await aiDocumentService.getDocumentSuggestions(
      req.params.projectId,
      req.body
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAutoComplete(req, res, next) {
  try {
    const result = await aiDocumentService.getAutoComplete(
      req.params.projectId,
      req.body
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function chatWithAI(req, res, next) {
  try {
    const result = await aiDocumentService.chatAboutDocument(
      req.params.projectId,
      req.body
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
