"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtpSms = exports.generateOtp = void 0;
const OTP_TTL_MS = 5 * 60 * 1000;
const generateOtp = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    return { code, expiresAt };
};
exports.generateOtp = generateOtp;
const sendOtpSms = async (phoneNumber, code) => {
    console.log(`[OTP SMS] phone=${phoneNumber} code=${code}`);
};
exports.sendOtpSms = sendOtpSms;
