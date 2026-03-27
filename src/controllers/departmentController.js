import * as deptService from '../services/departmentService.js';

export async function getDepartments(req, res, next) {
  try {
    const orgId = req.user.organization_id;
    const departments = await deptService.getDepartments(orgId);
    res.json({ data: departments });
  } catch (err) {
    next(err);
  }
}

export async function getDepartment(req, res, next) {
  try {
    const dept = await deptService.getDepartmentById(req.params.deptId);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    res.json({ data: dept });
  } catch (err) {
    next(err);
  }
}

export async function createDepartment(req, res, next) {
  try {
    const orgId = req.user.organization_id;
    const dept = await deptService.createDepartment(orgId, req.user.id, req.body);
    res.status(201).json({ data: dept });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Department with this name already exists' });
    }
    next(err);
  }
}

export async function updateDepartment(req, res, next) {
  try {
    const dept = await deptService.updateDepartment(req.params.deptId, req.body);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    res.json({ data: dept });
  } catch (err) {
    next(err);
  }
}

export async function deleteDepartment(req, res, next) {
  try {
    await deptService.deleteDepartment(req.params.deptId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getDepartmentMembers(req, res, next) {
  try {
    const members = await deptService.getDepartmentMembers(req.params.deptId);
    res.json({ data: members });
  } catch (err) {
    next(err);
  }
}
