import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import * as storageController from '../controllers/storageController.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

router.use(authenticate);

router.get('/:projectId/tasks/:taskId/attachments', requireProjectMember, storageController.list);
router.post('/:projectId/tasks/:taskId/attachments', requireProjectMember, upload.single('file'), storageController.upload);
router.delete('/:projectId/tasks/:taskId/attachments/:attachmentId', requireProjectMember, storageController.remove);

export default router;
