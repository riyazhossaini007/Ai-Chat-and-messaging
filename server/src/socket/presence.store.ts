const onlineUsers = new Map<string, Set<string>>();

export const addUserSocket = (userId: string, socketId: string) => {
  const existing = onlineUsers.get(userId) ?? new Set<string>();
  existing.add(socketId);
  onlineUsers.set(userId, existing);
  return existing.size;
};

export const removeUserSocket = (userId: string, socketId: string) => {
  const existing = onlineUsers.get(userId);
  if (!existing) {
    return 0;
  }

  existing.delete(socketId);
  if (existing.size === 0) {
    onlineUsers.delete(userId);
    return 0;
  }

  onlineUsers.set(userId, existing);
  return existing.size;
};

export const isUserOnline = (userId: string) => onlineUsers.has(userId);

export const getUserSockets = (userId: string) => {
  const sockets = onlineUsers.get(userId);
  return sockets ? Array.from(sockets) : [];
};

export const getOnlineUserIds = () => Array.from(onlineUsers.keys());
