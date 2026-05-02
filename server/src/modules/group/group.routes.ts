import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import {
  addMembers,
  createGroup,
  createInvite,
  deleteGroup,
  getGroupDetails,
  getGroupMessages,
  getGroupMessagesAround,
  getMyGroups,
  joinByInviteToken,
  leaveGroup,
  patchGroup,
  patchRules,
  postGroupRead,
  postGroupMessage,
  removeMember,
  revokeInvite,
  setAdminRole,
  transferCreator,
} from "./group.controller";
import { requireAtLeastAdmin, requireCreator, requireGroupMember } from "./group.permissions";

const groupRouter = Router();

groupRouter.post("/", requireAuth, createGroup);
groupRouter.get("/", requireAuth, getMyGroups);
groupRouter.post("/join/:token", requireAuth, joinByInviteToken);

groupRouter.get("/:groupId", requireAuth, requireGroupMember, getGroupDetails);
groupRouter.patch("/:groupId", requireAuth, requireAtLeastAdmin, patchGroup);
groupRouter.patch("/:groupId/rules", requireAuth, requireAtLeastAdmin, patchRules);

groupRouter.post("/:groupId/members", requireAuth, requireAtLeastAdmin, addMembers);
groupRouter.delete(
  "/:groupId/members/:userId",
  requireAuth,
  requireAtLeastAdmin,
  removeMember
);
groupRouter.post("/:groupId/leave", requireAuth, leaveGroup);
groupRouter.post("/:groupId/transfer-creator", requireAuth, requireCreator, transferCreator);

groupRouter.patch("/:groupId/admin-role", requireAuth, requireCreator, setAdminRole);
groupRouter.post("/:groupId/invite", requireAuth, requireAtLeastAdmin, createInvite);
groupRouter.post(
  "/:groupId/invite/revoke",
  requireAuth,
  requireAtLeastAdmin,
  revokeInvite
);

groupRouter.get("/:groupId/messages", requireAuth, requireGroupMember, getGroupMessages);
groupRouter.get("/:groupId/messages/around/:messageId", requireAuth, requireGroupMember, getGroupMessagesAround);
groupRouter.post("/:groupId/messages", requireAuth, requireGroupMember, postGroupMessage);
groupRouter.post("/:groupId/read", requireAuth, requireGroupMember, postGroupRead);

groupRouter.delete("/:groupId", requireAuth, requireCreator, deleteGroup);

export { groupRouter };
