import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { AwardService, type AwardAction } from '../services/award.service';

const ACTIONS: AwardAction[] = ['OPEN_NOMINATION', 'CLOSE_NOMINATION', 'OPEN_VOTING', 'CLOSE_VOTING', 'START_REVIEW', 'VERIFY', 'RETURN_TO_REVIEW', 'FINALIZE'];

const actor = (req: Request) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  return { id: req.user.userId, employeeId: req.user.employeeId, permissionTier: req.user.permissionTier };
};

/** Wraps a handler so a rejected promise always reaches the error handler. */
const handle =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export const AwardController = {
  // Everyone
  my: handle(async (req, res) => {
    res.json({ success: true, data: await AwardService.myAwards(actor(req)) });
  }),
  nominate: handle(async (req, res) => {
    await AwardService.nominate(req.params.categoryId, req.body ?? {}, actor(req));
    res.status(201).json({ success: true, message: 'Nomination submitted' });
  }),
  vote: handle(async (req, res) => {
    await AwardService.submitBallot(req.params.id, req.body ?? {}, actor(req));
    res.status(201).json({ success: true, message: 'Ballot submitted' });
  }),

  // HR (FULL)
  list: handle(async (_req, res) => {
    res.json({ success: true, data: await AwardService.listAwards() });
  }),
  get: handle(async (req, res) => {
    res.json({ success: true, data: await AwardService.getAward(req.params.id) });
  }),
  create: handle(async (req, res) => {
    res.status(201).json({ success: true, data: await AwardService.createAward(req.body ?? {}, actor(req)), message: 'Award created' });
  }),
  createRecognitionYear: handle(async (req, res) => {
    const data = await AwardService.createRecognitionYear(Number(req.body?.year), actor(req), req.body?.eligibilityDate);
    res.status(201).json({ success: true, data, message: 'Recognition awards created' });
  }),
  update: handle(async (req, res) => {
    res.json({ success: true, data: await AwardService.updateAward(req.params.id, req.body ?? {}, actor(req)), message: 'Award updated' });
  }),
  remove: handle(async (req, res) => {
    await AwardService.deleteAward(req.params.id, actor(req));
    res.json({ success: true, message: 'Award deleted' });
  }),
  transition: handle(async (req, res) => {
    const action = req.body?.action as AwardAction;
    if (!ACTIONS.includes(action)) throw new AppError('Unknown step.', 400);
    res.json({ success: true, data: await AwardService.transition(req.params.id, action, actor(req)) });
  }),
  decide: handle(async (req, res) => {
    res.json({ success: true, data: await AwardService.decideResult(req.params.resultId, req.body ?? {}, actor(req)) });
  }),
  confirmShortlist: handle(async (req, res) => {
    res.json({ success: true, data: await AwardService.confirmShortlist(req.params.id, actor(req)) });
  }),
  history: handle(async (_req, res) => {
    res.json({ success: true, data: await AwardService.history() });
  }),
  groups: handle(async (_req, res) => {
    res.json({ success: true, data: await AwardService.listGroups() });
  }),
  saveGroup: handle(async (req, res) => {
    await AwardService.saveGroup(req.params.groupId ?? null, req.body ?? {}, actor(req));
    res.json({ success: true, data: await AwardService.listGroups(), message: 'Group saved' });
  }),
  deleteGroup: handle(async (req, res) => {
    await AwardService.deleteGroup(req.params.groupId, actor(req));
    res.json({ success: true, data: await AwardService.listGroups(), message: 'Group deleted' });
  }),
  hallOfFame: handle(async (_req, res) => {
    res.json({ success: true, data: await AwardService.listHallOfFame() });
  }),
  recordHallOfFame: handle(async (req, res) => {
    await AwardService.recordHallOfFame(req.body ?? {}, actor(req));
    res.status(201).json({ success: true, data: await AwardService.listHallOfFame(), message: 'Hall of Fame record saved' });
  }),
  removeHallOfFame: handle(async (req, res) => {
    await AwardService.removeHallOfFame(req.params.recordId, actor(req));
    res.json({ success: true, data: await AwardService.listHallOfFame(), message: 'Hall of Fame record removed' });
  }),
};
