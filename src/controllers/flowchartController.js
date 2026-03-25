import * as flowchartService from '../services/flowchartService.js';

export async function list(req, res, next) {
  try {
    const flowcharts = await flowchartService.getFlowcharts(req.params.projectId);
    res.json(flowcharts);
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const flowchart = await flowchartService.getFlowchartById(
      req.params.projectId, req.params.flowchartId
    );

    if (!flowchart) {
      return res.status(404).json({ error: 'Flowchart not found' });
    }

    res.json(flowchart);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const flowchart = await flowchartService.createFlowchart(
      req.params.projectId, req.user.id, req.body
    );
    res.status(201).json(flowchart);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const flowchart = await flowchartService.updateFlowchart(
      req.params.projectId, req.params.flowchartId, req.body
    );

    if (!flowchart) {
      return res.status(404).json({ error: 'Flowchart not found' });
    }

    res.json(flowchart);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await flowchartService.deleteFlowchart(
      req.params.projectId, req.params.flowchartId, req.user.id
    );

    if (!result) {
      return res.status(404).json({ error: 'Flowchart not found' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
