"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOnlineUserIds = exports.getUserSockets = exports.isUserOnline = exports.removeUserSocket = exports.addUserSocket = void 0;
const onlineUsers = new Map();
const addUserSocket = (userId, socketId) => {
    const existing = onlineUsers.get(userId) ?? new Set();
    existing.add(socketId);
    onlineUsers.set(userId, existing);
    return existing.size;
};
exports.addUserSocket = addUserSocket;
const removeUserSocket = (userId, socketId) => {
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
exports.removeUserSocket = removeUserSocket;
const isUserOnline = (userId) => onlineUsers.has(userId);
exports.isUserOnline = isUserOnline;
const getUserSockets = (userId) => {
    const sockets = onlineUsers.get(userId);
    return sockets ? Array.from(sockets) : [];
};
exports.getUserSockets = getUserSockets;
const getOnlineUserIds = () => Array.from(onlineUsers.keys());
exports.getOnlineUserIds = getOnlineUserIds;
