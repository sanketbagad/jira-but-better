import { Router } from 'express';
import * as hrController from '../controllers/hrController.js';
import * as interviewController from '../controllers/interviewController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

// Admin/HR-only middleware
function requireAdmin(req, res, next) {
  if (!['admin', 'hr'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin or HR access required for HR functions' });
  }
  next();
}

// All HR routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// ============== OFFER LETTERS ==============

router.get(
  '/offer-letters',
  hrController.getOfferLetters
);

router.get(
  '/offer-letters/:id',
  hrController.getOfferLetter
);

router.post(
  '/offer-letters',
  validate(schemas.createOfferLetter),
  hrController.createOfferLetter
);

router.patch(
  '/offer-letters/:id',
  validate(schemas.updateOfferLetter),
  hrController.updateOfferLetter
);

router.delete(
  '/offer-letters/:id',
  hrController.deleteOfferLetter
);

router.post(
  '/offer-letters/:id/send',
  hrController.sendOfferLetterEmail
);

// ============== PAYSLIPS ==============

router.get(
  '/payslips',
  hrController.getPayslips
);

router.get(
  '/payslips/:id',
  hrController.getPayslip
);

router.post(
  '/payslips',
  validate(schemas.createPayslip),
  hrController.createPayslip
);

router.patch(
  '/payslips/:id',
  validate(schemas.updatePayslip),
  hrController.updatePayslip
);

router.delete(
  '/payslips/:id',
  hrController.deletePayslip
);

router.post(
  '/payslips/:id/send',
  hrController.sendPayslipEmail
);

// ============== EMPLOYEES ==============

router.get(
  '/employees',
  hrController.getEmployees
);

// ============== INTERVIEWS ==============

router.get(
  '/interviews',
  interviewController.getInterviews
);

router.get(
  '/interviews/interviewers',
  interviewController.getInterviewers
);

router.get(
  '/interviews/:id',
  interviewController.getInterview
);

router.post(
  '/interviews',
  validate(schemas.createInterview),
  interviewController.createInterview
);

router.patch(
  '/interviews/:id',
  validate(schemas.updateInterview),
  interviewController.updateInterview
);

router.delete(
  '/interviews/:id',
  interviewController.deleteInterview
);

router.post(
  '/interviews/:id/send',
  interviewController.sendInterviewInviteEmail
);

export default router;
