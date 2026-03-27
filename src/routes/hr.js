import { Router } from 'express';
import * as hrController from '../controllers/hrController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

// Admin-only middleware - checks if user is admin
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required for HR functions' });
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

export default router;
