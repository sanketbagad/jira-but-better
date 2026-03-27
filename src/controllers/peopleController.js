import * as peopleService from '../services/peopleService.js';

export async function createPerson(req, res, next) {
  try {
    const orgId = req.user.organization_id;
    const person = await peopleService.createPerson(orgId, req.body);
    res.status(201).json({ data: person });
  } catch (err) {
    if (err.code === '23505' && err.constraint?.includes('email')) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    next(err);
  }
}

export async function getPeople(req, res, next) {
  try {
    const orgId = req.user.organization_id;
    const { search, department_id, role, status } = req.query;
    const people = await peopleService.getPeople(orgId, { search, department_id, role, status });
    res.json({ data: people });
  } catch (err) {
    next(err);
  }
}

export async function getPerson(req, res, next) {
  try {
    const orgId = req.user.organization_id;
    const person = await peopleService.getPersonById(req.params.userId, orgId);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json({ data: person });
  } catch (err) {
    next(err);
  }
}

export async function updatePerson(req, res, next) {
  try {
    const person = await peopleService.updatePerson(req.params.userId, req.body);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json({ data: person });
  } catch (err) {
    next(err);
  }
}

export async function getDirectReports(req, res, next) {
  try {
    const reports = await peopleService.getDirectReports(req.params.userId);
    res.json({ data: reports });
  } catch (err) {
    next(err);
  }
}

export async function getReportingChain(req, res, next) {
  try {
    const chain = await peopleService.getReportingChain(req.params.userId);
    res.json({ data: chain });
  } catch (err) {
    next(err);
  }
}

export async function getOrgStats(req, res, next) {
  try {
    const orgId = req.user.organization_id;
    const stats = await peopleService.getOrgStats(orgId);
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
}
