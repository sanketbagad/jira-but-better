import * as storageService from '../services/storageService.js';

export async function upload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const attachment = await storageService.uploadAttachment(
      req.params.projectId,
      req.params.taskId,
      req.file,
      req.user.id
    );

    res.status(201).json(attachment);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const deleted = await storageService.deleteAttachment(
      req.params.attachmentId,
      req.params.taskId
    );

    if (!deleted) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const attachments = await storageService.getAttachments(req.params.taskId);
    res.json(attachments);
  } catch (err) {
    next(err);
  }
}
