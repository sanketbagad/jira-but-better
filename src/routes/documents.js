import { Router } from 'express';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as documentController from '../controllers/documentController.js';

const router = Router();

router.use(authenticate);

router.get('/:projectId/documents', requireProjectMember, documentController.list);
router.get('/:projectId/documents/:docId', requireProjectMember, documentController.getById);
router.post('/:projectId/documents', requireProjectMember, validate(schemas.createDocument), documentController.create);
router.post(
	'/:projectId/documents/ai/generate',
	requireProjectMember,
	validate(schemas.aiGenerateDocument),
	documentController.generateWithAI
);
router.post(
	'/:projectId/documents/ai/create',
	requireProjectMember,
	validate(schemas.aiGenerateDocument),
	documentController.createWithAI
);
router.post(
	'/:projectId/documents/ai/analyze',
	requireProjectMember,
	validate(schemas.aiAnalyzeDocument),
	documentController.analyzeWithAI
);
router.post(
	'/:projectId/documents/ai/suggestions',
	requireProjectMember,
	validate(schemas.aiDocumentSuggestions),
	documentController.getSuggestions
);
router.post(
	'/:projectId/documents/ai/autocomplete',
	requireProjectMember,
	validate(schemas.aiDocumentAutocomplete),
	documentController.getAutoComplete
);
router.post(
	'/:projectId/documents/ai/chat',
	requireProjectMember,
	validate(schemas.aiDocumentChat),
	documentController.chatWithAI
);
router.patch('/:projectId/documents/:docId', requireProjectMember, validate(schemas.updateDocument), documentController.update);
router.post('/:projectId/documents/:docId/duplicate', requireProjectMember, documentController.duplicate);
router.delete('/:projectId/documents/:docId', requireProjectMember, documentController.remove);

export default router;
