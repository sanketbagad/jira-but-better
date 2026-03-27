import * as commentService from '../services/taskCommentService.js';

// ============== Comments ==============

export async function listComments(req, res, next) {
  try {
    const comments = await commentService.getComments(req.params.taskId);
    res.json(comments);
  } catch (err) {
    next(err);
  }
}

export async function createComment(req, res, next) {
  try {
    const comment = await commentService.createComment(
      req.params.taskId,
      req.user.id,
      req.body
    );
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
}

export async function updateComment(req, res, next) {
  try {
    const comment = await commentService.updateComment(
      req.params.commentId,
      req.user.id,
      req.body.content
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found or not authorized' });
    }

    res.json(comment);
  } catch (err) {
    next(err);
  }
}

export async function deleteComment(req, res, next) {
  try {
    const result = await commentService.deleteComment(
      req.params.commentId,
      req.user.id
    );

    if (!result) {
      return res.status(404).json({ error: 'Comment not found or not authorized' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ============== Document Links ==============

export async function listLinkedDocuments(req, res, next) {
  try {
    const documents = await commentService.getLinkedDocuments(req.params.taskId);
    res.json(documents);
  } catch (err) {
    next(err);
  }
}

export async function linkDocument(req, res, next) {
  try {
    const link = await commentService.linkDocument(
      req.params.taskId,
      req.body.document_id,
      req.user.id
    );

    if (!link) {
      return res.status(400).json({ error: 'Document already linked or not found' });
    }

    res.status(201).json(link);
  } catch (err) {
    next(err);
  }
}

export async function unlinkDocument(req, res, next) {
  try {
    const result = await commentService.unlinkDocument(
      req.params.taskId,
      req.params.documentId,
      req.user.id
    );

    if (!result) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ============== Task History ==============

export async function getHistory(req, res, next) {
  try {
    const history = await commentService.getTaskHistory(req.params.taskId);
    res.json(history);
  } catch (err) {
    next(err);
  }
}

// ============== Watchers ==============

export async function listWatchers(req, res, next) {
  try {
    const watchers = await commentService.getWatchers(req.params.taskId);
    res.json(watchers);
  } catch (err) {
    next(err);
  }
}

export async function addWatcher(req, res, next) {
  try {
    await commentService.addWatcher(req.params.taskId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function removeWatcher(req, res, next) {
  try {
    await commentService.removeWatcher(req.params.taskId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function checkWatching(req, res, next) {
  try {
    const isWatching = await commentService.isWatching(req.params.taskId, req.user.id);
    res.json({ watching: isWatching });
  } catch (err) {
    next(err);
  }
}
