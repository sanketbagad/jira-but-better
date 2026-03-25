import { Router } from 'express';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as githubController from '../controllers/githubController.js';

const router = Router();

router.use(authenticate);

router.post('/connect/:projectId', requireProjectMember, validate(schemas.connectGitHub), githubController.connect);
router.delete('/disconnect/:projectId', requireProjectMember, githubController.disconnect);
router.get('/:projectId/repo', requireProjectMember, githubController.getRepo);
router.get('/:projectId/commits', requireProjectMember, githubController.getCommits);
router.get('/:projectId/branches', requireProjectMember, githubController.getBranches);
router.get('/:projectId/pulls', requireProjectMember, githubController.getPulls);
router.get('/:projectId/files', requireProjectMember, githubController.getFiles);

export default router;
