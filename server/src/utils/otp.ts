const OTP_TTL_MS = 5 * 60 * 1000;

export const generateOtp = () => {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  return { code, expiresAt };
};

export const sendOtpSms = async (phoneNumber: string, code: string) => {
  console.log(`[OTP SMS] phone=${phoneNumber} code=${code}`);
};
