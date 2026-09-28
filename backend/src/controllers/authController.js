const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { sendFarmerRegistrationEmail } = require("../services/emailService");
const { verifyGoogleIdToken } = require("../services/googleAuthService");
const twilioService = require("../services/twilioService");

function publicUser(user) {
  const obj = user.toObject();
  delete obj.password;
  return obj;
}

async function register(req, res) {
  const { name, email, password, phone, address, role = "customer", farmerProfile = {} } = req.body;
  if (!name || !email || !password) return res.status(400).json({ success: false, message: "Name, email and password are required" });
  if (!["customer", "farmer"].includes(role)) return res.status(400).json({ success: false, message: "Registration role must be customer or farmer" });

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(409).json({ success: false, message: "Email is already registered" });

  const user = await User.create({
    name, email: email.toLowerCase(), password: await bcrypt.hash(password, 12),
    phone, address, role,
    phoneVerified: phone ? twilioService.consumeVerifiedPhone(phone) : false,
    farmerProfile: role === "farmer" ? { ...farmerProfile, approvalStatus: "pending" } : undefined
  });

  if (role === "farmer") {
    await sendFarmerRegistrationEmail(user);
  }

  res.status(201).json({ success: true, message: role === "farmer" ? "Farmer registered and awaiting admin approval" : "Registration successful", token: generateToken(user), user: publicUser(user) });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email || "").toLowerCase() });
  if (!user || !user.isActive || !(await bcrypt.compare(password || "", user.password))) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }
  res.json({ success: true, token: generateToken(user), user: publicUser(user) });
}

async function me(req, res) {
  res.json({ success: true, user: req.user });
}

async function updateProfile(req, res) {
  const allowed = ["name", "phone", "address"];
  allowed.forEach(k => { if (req.body[k] !== undefined) req.user[k] = req.body[k]; });
  if (req.user.role === "farmer" && req.body.farmerProfile) {
    const incoming = req.body.farmerProfile;
    const current = req.user.farmerProfile?.toObject ? req.user.farmerProfile.toObject() : (req.user.farmerProfile || {});
    const next = { ...current };
    const allowed = [
      "stallName", "contactPerson", "businessAddress",
      "operatingDays", "pickupWindowStart", "pickupWindowEnd",
      "cutoffMinutes", "latitude", "longitude"
    ];
    for (const key of allowed) {
      if (incoming[key] !== undefined) next[key] = incoming[key];
    }
    // approvalStatus and markets are admin-controlled and are intentionally ignored.
    if (incoming.cutoffMinutes !== undefined) {
      const cutoff = Number(incoming.cutoffMinutes);
      if (!Number.isFinite(cutoff) || cutoff < 0 || cutoff > 1440) {
        return res.status(400).json({ success: false, message: "Cutoff minutes must be between 0 and 1440" });
      }
      next.cutoffMinutes = cutoff;
    }
    if (incoming.latitude !== undefined && incoming.latitude !== "") {
      const latitude = Number(incoming.latitude);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return res.status(400).json({ success: false, message: "Latitude must be between -90 and 90" });
      next.latitude = latitude;
    }
    if (incoming.longitude !== undefined && incoming.longitude !== "") {
      const longitude = Number(incoming.longitude);
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return res.status(400).json({ success: false, message: "Longitude must be between -180 and 180" });
      next.longitude = longitude;
    }
    req.user.farmerProfile = next;
  }
  await req.user.save();
  res.json({ success: true, user: publicUser(req.user) });
}

async function googleAuth(req, res) {
  const { idToken, role = "customer" } = req.body;
  const profile = await verifyGoogleIdToken(idToken);
  if (profile.emailVerified !== true) {
    return res.status(401).json({ success: false, message: "Google account email is not verified" });
  }

  if (!["customer", "farmer"].includes(role)) {
    return res.status(400).json({ success: false, message: "Role must be customer or farmer" });
  }

  let user = await User.findOne({ googleId: profile.googleId });

  if (!user) {
    // No account linked to this Google ID yet — check if the email is
    // already registered (e.g. via password signup) and link it instead
    // of creating a duplicate account.
    user = await User.findOne({ email: profile.email.toLowerCase() });

    if (user) {
      user.googleId = profile.googleId;
      await user.save();
    } else {
      user = await User.create({
        name: profile.name,
        email: profile.email.toLowerCase(),
        googleId: profile.googleId,
        role,
        farmerProfile: role === "farmer" ? { approvalStatus: "pending" } : undefined
      });
      if (role === "farmer") await sendFarmerRegistrationEmail(user);
    }
  }

  if (!user.isActive) {
    return res.status(401).json({ success: false, message: "User account is unavailable" });
  }

  res.json({ success: true, token: generateToken(user), user: publicUser(user) });
}

async function sendPhoneOtp(req, res) {
  const { phone } = req.body;
  const result = await twilioService.sendOtp(phone);
  res.json({ success: true, message: "Verification code sent", ...(twilioService.twilioConfigured() ? {} : { devNote: "Twilio not configured — check server logs for the code" }), sent: result.sent });
}

async function verifyPhoneOtp(req, res) {
  const { phone, code } = req.body;
  twilioService.verifyOtp(phone, code);
  res.json({ success: true, message: "Phone number verified" });
}

module.exports = { register, login, me, updateProfile, googleAuth, sendPhoneOtp, verifyPhoneOtp };
