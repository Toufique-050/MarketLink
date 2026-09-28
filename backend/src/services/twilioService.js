const twilio = require("twilio");

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds

// In-memory OTP store: phone -> { code, expiresAt, attempts, lastSentAt }
// NOTE: this resets on server restart and only works on a single instance.
// For multi-server / production deployments, move this to Redis or Mongo.
const otpStore = new Map();

// Short-lived record of numbers that just passed OTP verification, so
// register() can trust a phone as verified without re-checking the code.
const VERIFIED_TTL_MS = 15 * 60 * 1000; // 15 minutes
const verifiedStore = new Map();

function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

let client;
function getClient() {
  if (!client) client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return client;
}

function normalizePhone(phone) {
  return String(phone || "").trim();
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

async function sendOtp(phone) {
  const to = normalizePhone(phone);
  if (!to) {
    const error = new Error("Phone number is required");
    error.statusCode = 400;
    throw error;
  }

  const existing = otpStore.get(to);
  if (existing && Date.now() - existing.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    const error = new Error("Please wait before requesting another code");
    error.statusCode = 429;
    throw error;
  }

  const code = generateCode();
  otpStore.set(to, { code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, lastSentAt: Date.now() });

  if (!twilioConfigured()) {
    // Lets the app keep working in development without Twilio credentials.
    console.warn(`[TWILIO] Not configured. OTP for ${to} is ${code} (dev fallback, not sent via SMS)`);
    return { sent: false, skipped: true, reason: "Twilio not configured" };
  }

  try {
    const message = await getClient().messages.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: `Your MarketLink verification code is ${code}. It expires in 5 minutes.`
    });
    console.log(`[TWILIO] OTP sent to ${to}. SID: ${message.sid}`);
    return { sent: true, sid: message.sid };
  } catch (error) {
    console.error(`[TWILIO] Failed to send OTP to ${to}: ${error.message}`);
    const err = new Error("Failed to send verification SMS");
    err.statusCode = 502;
    throw err;
  }
}

function verifyOtp(phone, code) {
  const to = normalizePhone(phone);
  const record = otpStore.get(to);

  if (!record) {
    const error = new Error("No verification code was requested for this number");
    error.statusCode = 400;
    throw error;
  }
  if (Date.now() > record.expiresAt) {
    otpStore.delete(to);
    const error = new Error("Verification code has expired. Please request a new one");
    error.statusCode = 400;
    throw error;
  }
  if (record.attempts >= 5) {
    otpStore.delete(to);
    const error = new Error("Too many incorrect attempts. Please request a new code");
    error.statusCode = 429;
    throw error;
  }
  if (String(code || "") !== record.code) {
    record.attempts += 1;
    const error = new Error("Incorrect verification code");
    error.statusCode = 400;
    throw error;
  }

  otpStore.delete(to);
  verifiedStore.set(to, Date.now() + VERIFIED_TTL_MS);
  return true;
}

/** Checks (and consumes) whether a phone recently passed OTP verification. */
function consumeVerifiedPhone(phone) {
  const to = normalizePhone(phone);
  const expiresAt = verifiedStore.get(to);
  if (!expiresAt) return false;
  verifiedStore.delete(to);
  return Date.now() <= expiresAt;
}

module.exports = { sendOtp, verifyOtp, consumeVerifiedPhone, twilioConfigured };
