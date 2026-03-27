import * as hrService from '../services/hrService.js';
import { supabase } from '../config/supabase.js';
import { sendOfferLetterToCandidate, sendPayslipToEmployee } from '../services/email.js';

// Helper to emit to global HR channel (all connected clients)
function emitToAll(event, data) {
  if (!supabase) return;
  const channel = supabase.channel('global:hr');
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.send({ type: 'broadcast', event, payload: data });
    }
  });
}

// ============== OFFER LETTERS ==============

export async function getOfferLetters(req, res, next) {
  try {
    const letters = await hrService.getOfferLetters(req.query);
    res.json(letters);
  } catch (err) {
    next(err);
  }
}

export async function getOfferLetter(req, res, next) {
  try {
    const letter = await hrService.getOfferLetterById(req.params.id);
    if (!letter) {
      return res.status(404).json({ error: 'Offer letter not found' });
    }
    res.json(letter);
  } catch (err) {
    next(err);
  }
}

export async function createOfferLetter(req, res, next) {
  try {
    const letter = await hrService.createOfferLetter(req.user.id, req.body);
    
    emitToAll('hr:offer-letter:created', letter);
    
    res.status(201).json(letter);
  } catch (err) {
    next(err);
  }
}

export async function updateOfferLetter(req, res, next) {
  try {
    const { id } = req.params;
    const letter = await hrService.updateOfferLetter(id, req.user.id, req.body);
    
    if (!letter) {
      return res.status(404).json({ error: 'Offer letter not found' });
    }
    
    emitToAll('hr:offer-letter:updated', letter);
    
    res.json(letter);
  } catch (err) {
    next(err);
  }
}

export async function deleteOfferLetter(req, res, next) {
  try {
    const { id } = req.params;
    await hrService.deleteOfferLetter(id);
    
    emitToAll('hr:offer-letter:deleted', { id });
    
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function sendOfferLetterEmail(req, res, next) {
  try {
    const { id } = req.params;
    const letter = await hrService.getOfferLetterById(id);
    
    if (!letter) {
      return res.status(404).json({ error: 'Offer letter not found' });
    }
    
    if (!letter.candidate_email) {
      return res.status(400).json({ error: 'Candidate email is required to send the offer letter' });
    }

    const { pdfBase64 } = req.body || {};
    await sendOfferLetterToCandidate(letter, pdfBase64);

    // Update status to sent
    await hrService.updateOfferLetter(id, req.user.id, { status: 'sent' });

    res.json({ message: 'Offer letter sent successfully', sent_to: letter.candidate_email });
  } catch (err) {
    next(err);
  }
}

// ============== PAYSLIPS ==============

export async function getPayslips(req, res, next) {
  try {
    const payslips = await hrService.getPayslips(req.query);
    res.json(payslips);
  } catch (err) {
    next(err);
  }
}

export async function getPayslip(req, res, next) {
  try {
    const payslip = await hrService.getPayslipById(req.params.id);
    if (!payslip) {
      return res.status(404).json({ error: 'Payslip not found' });
    }
    res.json(payslip);
  } catch (err) {
    next(err);
  }
}

export async function createPayslip(req, res, next) {
  try {
    const payslip = await hrService.createPayslip(req.user.id, req.body);
    
    emitToAll('hr:payslip:created', payslip);
    
    res.status(201).json(payslip);
  } catch (err) {
    next(err);
  }
}

export async function updatePayslip(req, res, next) {
  try {
    const { id } = req.params;
    const payslip = await hrService.updatePayslip(id, req.user.id, req.body);
    
    if (!payslip) {
      return res.status(404).json({ error: 'Payslip not found' });
    }
    
    emitToAll('hr:payslip:updated', payslip);
    
    res.json(payslip);
  } catch (err) {
    next(err);
  }
}

export async function deletePayslip(req, res, next) {
  try {
    const { id } = req.params;
    await hrService.deletePayslip(id);
    
    emitToAll('hr:payslip:deleted', { id });
    
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function sendPayslipEmail(req, res, next) {
  try {
    const { id } = req.params;
    const slip = await hrService.getPayslipById(id);

    if (!slip) {
      return res.status(404).json({ error: 'Payslip not found' });
    }

    if (!slip.employee_email) {
      return res.status(400).json({ error: 'Employee email is required to send the payslip' });
    }

    const { pdfBase64 } = req.body || {};
    await sendPayslipToEmployee(slip, pdfBase64);

    // Update status to sent
    await hrService.updatePayslip(id, req.user.id, { status: 'sent' });

    res.json({ message: 'Payslip sent successfully', sent_to: slip.employee_email });
  } catch (err) {
    next(err);
  }
}

// ============== EMPLOYEES ==============

export async function getEmployees(req, res, next) {
  try {
    const employees = await hrService.getAllEmployees();
    res.json(employees);
  } catch (err) {
    next(err);
  }
}
