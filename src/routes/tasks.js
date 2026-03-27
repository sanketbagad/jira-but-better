import { Router } from 'express';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as taskController from '../controllers/taskController.js';
import * as taskCommentController from '../controllers/taskCommentController.js';

const router = Router();

router.use(authenticate);

// Task CRUD
router.get('/:projectId/tasks', requireProjectMember, taskController.list);
router.get('/:projectId/tasks/:taskId', requireProjectMember, taskController.getById);
router.post('/:projectId/tasks', requireProjectMember, validate(schemas.createTask), taskController.create);
router.patch('/:projectId/tasks/:taskId', requireProjectMember, validate(schemas.updateTask), taskController.update);
router.delete('/:projectId/tasks/:taskId', requireProjectMember, taskController.remove);

// Task Comments
router.get('/:projectId/tasks/:taskId/comments', requireProjectMember, taskCommentController.listComments);
router.post('/:projectId/tasks/:taskId/comments', requireProjectMember, validate(schemas.createTaskComment), taskCommentController.createComment);
router.patch('/:projectId/tasks/:taskId/comments/:commentId', requireProjectMember, taskCommentController.updateComment);
router.delete('/:projectId/tasks/:taskId/comments/:commentId', requireProjectMember, taskCommentController.deleteComment);

// Task Document Links
router.get('/:projectId/tasks/:taskId/documents', requireProjectMember, taskCommentController.listLinkedDocuments);
router.post('/:projectId/tasks/:taskId/documents', requireProjectMember, taskCommentController.linkDocument);
router.delete('/:projectId/tasks/:taskId/documents/:documentId', requireProjectMember, taskCommentController.unlinkDocument);

// Task History
router.get('/:projectId/tasks/:taskId/history', requireProjectMember, taskCommentController.getHistory);

// Task Watchers
router.get('/:projectId/tasks/:taskId/watchers', requireProjectMember, taskCommentController.listWatchers);
router.get('/:projectId/tasks/:taskId/watching', requireProjectMember, taskCommentController.checkWatching);
router.post('/:projectId/tasks/:taskId/watch', requireProjectMember, taskCommentController.addWatcher);
router.delete('/:projectId/tasks/:taskId/watch', requireProjectMember, taskCommentController.removeWatcher);

export default router;
