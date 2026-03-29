import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { Sequelize, DataTypes } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import https from 'https';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { Resend } from 'resend';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import nodemailer from 'nodemailer';
import webPush from 'web-push';

dotenv.config();

// -----------------------------------------------------------------------------
// 2. APP INITIALIZATION & MIDDLEWARE
// -----------------------------------------------------------------------------

// Initialize Web Push with VAPID details
webPush.setVapidDetails(
  `mailto:${process.env.FROM_EMAIL || 'admin@mutsda.org'}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.CORS_ORIGIN,
      'http://localhost:5173',
      'http://localhost:5000',
      'https://mutsda.onrender.com',
      'https://philologic-debi-unsophisticatedly.ngrok-free.dev'
    ].filter(Boolean);

    // In development only, allow configured ngrok domains via env var
    const allowedNgrokDomain = process.env.ALLOWED_NGROK_DOMAIN; // e.g. "myapp.ngrok-free.app"

    if (!origin) return callback(null, true); // allow non-browser requests (mobile apps, curl)

    if (
      allowedOrigins.includes(origin) ||
      (allowedNgrokDomain && origin === `https://${allowedNgrokDomain}`)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};


app.use(cors(corsOptions));
// Capture raw body for webhook signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));


app.get('/ping', (req, res) => res.status(200).send('OK'));
// -----------------------------------------------------------------------------
// 3. DATABASE SETUP (from database.js)
// -----------------------------------------------------------------------------

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: false,
    timezone: '+00:00', // Store everything in UTC to support dynamic conversion for global users
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
);

sequelize.authenticate()
  .then(() => {
    console.log('MySQL Connected');

    if (process.env.NODE_ENV !== 'production') {
      return sequelize.sync();
    } else {
      console.log('Production mode: Skipping sequelize.sync()');
      return Promise.resolve();
    }
  })
  .then(() => console.log('Database operation complete'))
  .catch(err => console.error('MySQL Connection Error:', err));

// -----------------------------------------------------------------------------
// 4. MODELS (from /models folder)
// -----------------------------------------------------------------------------

const User = sequelize.define('User', {
  full_name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('member', 'deacon', 'elder', 'pastor', 'admin'), defaultValue: 'member' },
  profile_photo_url: DataTypes.STRING,
  phone: DataTypes.STRING,
  address: DataTypes.STRING,
  date_of_birth: DataTypes.DATEONLY,
  baptism_date: DataTypes.DATEONLY,
  emergency_contact: DataTypes.STRING,
  resetPasswordToken: DataTypes.STRING,
  resetPasswordExpires: DataTypes.DATE,
  push_subscription: DataTypes.TEXT, // Store JSON string of push subscription
  push_notifications_enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  is_banned: { type: DataTypes.BOOLEAN, defaultValue: false },
  last_active: DataTypes.DATE,
}, { timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });

const Sermon = sequelize.define('Sermon', {
  title: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  speaker: DataTypes.STRING,
  sermon_date: DataTypes.DATE,
  category: { type: DataTypes.ENUM('sabbath', 'youth', 'revival', 'special_program', 'prayer_meeting', 'bible_study'), defaultValue: 'sabbath' },
  video_link: DataTypes.STRING,
  audio_url: DataTypes.STRING,
  notes_pdf_url: DataTypes.STRING,
  thumbnail_url: DataTypes.STRING,
  published: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });

const SermonView = sequelize.define('SermonView', {
  sermon_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: true },
}, { timestamps: true, createdAt: 'created_date', updatedAt: false });

const SermonLike = sequelize.define('SermonLike', {
  sermon_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
}, { timestamps: true, createdAt: 'created_date', updatedAt: false });

const SermonComment = sequelize.define('SermonComment', {
  sermon_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  parent_id: { type: DataTypes.INTEGER, allowNull: true },
}, { timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });

const Event = sequelize.define('Event', {
  title: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  event_date: DataTypes.DATE,
  end_date: DataTypes.DATE,
  location: DataTypes.STRING,
  category: { type: DataTypes.ENUM('worship', 'youth', 'outreach', 'fellowship', 'seminar', 'camp_meeting', 'special'), defaultValue: 'worship' },
  rsvp_enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  published: { type: DataTypes.BOOLEAN, defaultValue: true },
  banner_image_url: DataTypes.STRING,
  video_link: DataTypes.STRING,
}, { timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });

const Donation = sequelize.define('Donation', {
  donor_name: DataTypes.STRING,
  donor_email: DataTypes.STRING,
  donation_type: { type: DataTypes.ENUM('tithe', 'offering', 'building_fund', 'mission_fund', 'custom'), defaultValue: 'offering' },
  custom_fund_name: DataTypes.STRING,
  amount: DataTypes.DECIMAL(10, 2),
  payment_method: DataTypes.STRING,
  transaction_reference: DataTypes.STRING,
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
}, { timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });

const Announcement = sequelize.define('Announcement', {
  title: { type: DataTypes.STRING, allowNull: false },
  content: DataTypes.TEXT,
  category: { type: DataTypes.ENUM('general', 'urgent', 'event', 'ministry', 'youth'), defaultValue: 'general' },
  pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
  published: { type: DataTypes.BOOLEAN, defaultValue: true },
  banner_image_url: DataTypes.STRING,
}, { timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });

const MediaItem = sequelize.define('MediaItem', {
  title: DataTypes.STRING,
  description: DataTypes.TEXT,
  media_type: { type: DataTypes.ENUM('photo', 'video', 'document', 'audio'), defaultValue: 'photo' },
  album: DataTypes.STRING,
  event_name: DataTypes.STRING,
  file_url: { type: DataTypes.STRING, allowNull: false },
  cover_image_url: DataTypes.STRING,
}, { timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });

const ContactMessage = sequelize.define('ContactMessage', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  subject: DataTypes.STRING,
  message: { type: DataTypes.TEXT, allowNull: false },
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });

const ChatGroup = sequelize.define('ChatGroup', {
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: DataTypes.TEXT,
}, { timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });

const ChatMessage = sequelize.define('ChatMessage', {
  message: { type: DataTypes.TEXT, allowNull: true },
  sender_name: DataTypes.STRING,
  sender_email: DataTypes.STRING,
  sender_profile_photo_url: DataTypes.STRING,
  channel: { type: DataTypes.STRING, defaultValue: 'general' },
  media_url: DataTypes.STRING,
  media_type: DataTypes.STRING,
  media_filename: DataTypes.STRING,
  reply_to_message_id: DataTypes.INTEGER,
  reply_to_sender_name: DataTypes.STRING,
  reply_to_message_snippet: DataTypes.TEXT,
}, { timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });

// AI Chat model — stores per-user conversation history with the AI pastor
const AiChatMessage = sequelize.define('AiChatMessage', {
  user_email: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('user', 'model'), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  session_id: { type: DataTypes.STRING, allowNull: true }, // groups messages into one conversation session
}, { timestamps: true, createdAt: 'created_date', updatedAt: false });

// DirectMessage model — private one-to-one messages between users
const DirectMessage = sequelize.define('DirectMessage', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  sender_email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sender_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sender_profile_photo_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  recipient_email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  channel: {
    type: DataTypes.STRING(512),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  media_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  media_type: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  media_filename: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true,
  createdAt: 'created_date',
  updatedAt: 'updated_date'
});


const RSVP = sequelize.define('RSVP', {
  event_id: { type: DataTypes.INTEGER, allowNull: false },
  member_email: { type: DataTypes.STRING, allowNull: false },
  member_name: DataTypes.STRING,
  status: { type: DataTypes.ENUM('attending', 'not_attending', 'maybe'), defaultValue: 'attending' },
}, { timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });

// Define relationships for Chat
User.belongsToMany(ChatGroup, { through: 'ChatGroupMembers' });
ChatGroup.belongsToMany(User, { through: 'ChatGroupMembers' });

SermonComment.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
SermonComment.hasMany(SermonComment, { as: 'Replies', foreignKey: 'parent_id' });

// -----------------------------------------------------------------------------
// 5. MIDDLEWARE (from /middleware)
// -----------------------------------------------------------------------------

// File upload middleware
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'mutsda_uploads',
      resource_type: 'auto', // Automatically detect image/video/raw
      public_id: `${req.user ? req.user.id : 'anon'}-${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_")}`,
    };
  },
});
const upload = multer({ storage: storage });

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      if (req.user && req.user.is_banned) {
        return res.status(403).json({ message: 'Your account has been suspended.' });
      }

      // FIX: If the token is valid but the user was deleted/not found
      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user no longer exists' });
      }

      return next(); // Use return to ensure no other code in this function runs
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    // FIX: Added return here to prevent execution from continuing
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'pastor')) {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

// -----------------------------------------------------------------------------
// 6. CONTROLLERS (from /controllers)
// -----------------------------------------------------------------------------

// Helper function for sending email

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Create a transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || process.env.EMAIL_HOST,
  port: process.env.SMTP_PORT || process.env.EMAIL_PORT || 587,
  secure: (process.env.SMTP_PORT || process.env.EMAIL_PORT) == 465,
  auth: {
    user: process.env.SMTP_EMAIL || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASSWORD || process.env.EMAIL_PASS,
  },
});

const sendEmail = async (options) => {
  // Check for required environment variables
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const user = process.env.SMTP_EMAIL || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASS;
  const from = process.env.FROM_EMAIL;

  if (!host || !user || !pass || !from) {
    console.error('Email configuration missing. Please check SMTP_HOST, SMTP_EMAIL, SMTP_PASSWORD, and FROM_EMAIL in .env');
    return Promise.reject('Email service not configured.');
  }

  const mailOptions = {
    from: `"${process.env.FROM_NAME || 'MUTSDA Church'}" <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent successfully: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Nodemailer Send Error:', error.message);
    throw new Error('Failed to send email.');
  }
};

// Helper function to create a branded HTML email
const createStyledEmail = (title, content) => {
  const primaryColor = '#1a2744';
  const accentColor = '#c8a951';
  const backgroundColor = '#f4f4f4';
  const textColor = '#333333';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${backgroundColor}; color: ${textColor}; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        .header { background-color: ${primaryColor}; color: white; padding: 25px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; color: ${accentColor}; font-family: Georgia, serif; }
        .content { padding: 30px 40px; }
        .content h2 { color: ${primaryColor}; font-family: Georgia, serif; font-size: 22px; }
        .content p { line-height: 1.6; margin: 0 0 15px; font-size: 16px; }
        .button-container { text-align: center; margin: 30px 0; }
        .button { display: inline-block; background-color: ${accentColor}; color: ${primaryColor} !important; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #777777; }
        .footer a { color: ${primaryColor}; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>MUTSDA Church</h1>
        </div>
        <div class="content">
          <h2>${title}</h2>
          ${content}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} MUTSDA Church. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Generic Controller Factory for simple CRUD
const createController = (model, namespace) => ({
  getAll: async (req, res) => {
    try {
      // Do not pass raw req.query to the DB — it would allow any column to be
      // used as a filter, enabling data enumeration and unexpected behaviour.
      // Callers that need filtering should override getAll in their own controller.
      const items = await model.findAll({ order: [['created_date', 'DESC']] });
      res.json(items);
    } catch (err) {
      console.error(`Error in ${model.name} getAll:`, err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  getById: async (req, res) => {
    try {
      const item = await model.findByPk(req.params.id);
      if (!item) return res.status(404).json({ message: 'Item not found' });
      res.json(item);
    } catch (err) {
      console.error(`Error in ${model.name} getById:`, err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  create: async (req, res) => {
    try {
      const item = await model.create(req.body);
      if (namespace && req.app.get('io')) {
        req.app.get('io').emit(`${namespace}_updated`);
      }
      res.status(201).json(item);
    } catch (err) {
      console.error(`Error in ${model.name} create:`, err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  update: async (req, res) => {
    try {
      const item = await model.findByPk(req.params.id);
      if (!item) return res.status(404).json({ message: 'Item not found' });
      await item.update(req.body);
      if (namespace && req.app.get('io')) {
        req.app.get('io').emit(`${namespace}_updated`);
      }
      res.json(item);
    } catch (err) {
      console.error(`Error in ${model.name} update:`, err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  delete: async (req, res) => {
    try {
      const item = await model.findByPk(req.params.id);
      if (!item) return res.status(404).json({ message: 'Item not found' });
      await item.destroy();
      if (namespace && req.app.get('io')) {
        req.app.get('io').emit(`${namespace}_updated`);
      }
      res.json({ message: 'Item removed' });
    } catch (err) {
      console.error(`Error in ${model.name} delete:`, err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
});

const authController = {
  register: async (req, res) => {
    const { full_name, email, password } = req.body;
    try {
      const userExists = await User.findOne({ where: { email } });
      if (userExists) return res.status(400).json({ message: 'User already exists' });

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = await User.create({ full_name, email, password: hashedPassword });

      res.status(201).json({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        token: jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' }),
      });
    } catch (err) {
      console.error('Error in auth register:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  login: async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await User.findOne({ where: { email } });
      if (user && (await bcrypt.compare(password, user.password))) {
        if (user.is_banned) {
          return res.status(403).json({ message: 'Your account has been suspended. Please contact administration.' });
        }

        res.json({
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          token: jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' }),
        });
      } else {
        res.status(401).json({ message: 'Invalid email or password' });
      }
    } catch (err) {
      console.error('Error in auth login:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  googleLogin: async (req, res) => {
    const { token } = req.body;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const { name, email, picture } = ticket.getPayload();

      let user = await User.findOne({ where: { email } });

      if (user && user.is_banned) {
        return res.status(403).json({ message: 'Your account has been suspended.' });
      }

      if (!user) {
        // Create new user if they don't exist
        const salt = await bcrypt.genSalt(10);
        const randomPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, salt);

        user = await User.create({
          full_name: name,
          email,
          password: hashedPassword,
          profile_photo_url: picture,
          role: 'member',
        });
      }

      res.json({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        profile_photo_url: user.profile_photo_url,
        token: jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' }),
      });
    } catch (err) {
      console.error('Google Auth Error:', err);
      res.status(401).json({ message: 'Google authentication failed' });
    }
  },
  getMe: async (req, res) => {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    res.json(user);
  },
  updateMe: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (user) {
        // Whitelist only the fields a user may update on their own profile.
        // Never allow role, email, password, or reset tokens to be changed here.
        const ALLOWED_FIELDS = ['full_name', 'phone', 'address', 'date_of_birth', 'emergency_contact', 'push_notifications_enabled'];
        const updateData = {};
        for (const field of ALLOWED_FIELDS) {
          if (req.body[field] !== undefined) updateData[field] = req.body[field];
        }
        await user.update(updateData);
        const updatedUser = await User.findByPk(req.user.id, {
          attributes: { exclude: ['password'] }
        });
        res.json(updatedUser);
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (err) {
      console.error('Error in auth updateMe:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  changePassword: async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Incorrect current password' });

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      await user.save();
      res.json({ message: 'Password updated successfully' });
    } catch (err) {
      console.error('Error in changePassword:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  invite: async (req, res) => {
    const { email, role } = req.body;
    try {
      const userExists = await User.findOne({ where: { email } });
      if (userExists) return res.status(400).json({ message: 'User with this email already exists' });

      // Generate a random temporary password
      const tempPassword = crypto.randomBytes(8).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(tempPassword, salt);

      // Extract name from email for a placeholder
      const fullName = email.split('@')[0];

      const user = await User.create({
        full_name: fullName,
        email,
        password: hashedPassword,
        role: role || 'member',
      });

      console.log('--- USER INVITED ---');
      console.log(`User ${email} invited. They should use "Forgot Password" to set their own password.`);
      console.log('--------------------');

      if (req.app.get('io')) {
        req.app.get('io').emit('users_updated');
      }
      res.status(201).json(user);
    } catch (err) {
      console.error('INVITE ERROR:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  forgotPassword: async (req, res) => {
    const { email } = req.body;
    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(200).json({ message: 'If an account with that email exists, an OTP has been sent.' });
      }

      // 1. Generate a cryptographically secure 6-digit OTP
      const otp = crypto.randomInt(100000, 1000000).toString();

      // 2. Hash the OTP and set it on the user model
      user.resetPasswordToken = crypto
        .createHash('sha256')
        .update(otp)
        .digest('hex');

      // 3. Set an expiry time (e.g., 15 minutes)
      user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;

      await user.save();

      try {
        const emailContent = `
          <p>Hello ${user.full_name.split(' ')[0]},</p>
          <p>You requested a password reset. Your OTP (One-Time Password) is:</p>
          <h2 style="color: #1a2744; font-size: 32px; letter-spacing: 5px; margin: 20px 0;">${otp}</h2>
          <p>This code will expire in 15 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
          <p>Thank you,<br>The MUTSDA Team</p>
        `;
        const textVersion = `Hello ${user.full_name.split(' ')[0]},\n\nYour password reset OTP is: ${otp}\n\nExpires in 15 minutes.\n\nThank you,\nThe MUTSDA Team`;
        const html = createStyledEmail('Password Reset OTP', emailContent);

        await sendEmail({
          email: user.email,
          subject: 'Password Reset OTP - MUTSDA',
          message: textVersion,
          html: html
        });

        res.status(200).json({ message: 'OTP sent to your email.' });
      } catch (err) {
        console.error(err);
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();
        return res.status(500).json({ message: 'Email could not be sent' });
      }
    } catch (err) {
      console.error('FORGOT PASSWORD ERROR:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  verifyOtp: async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Please provide email and OTP.' });
    }

    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex');

    try {
      const user = await User.findOne({
        where: {
          email,
          resetPasswordToken,
          resetPasswordExpires: { [Sequelize.Op.gt]: Date.now() }
        }
      });

      if (!user) {
        return res.status(400).json({ message: 'Invalid OTP or email, or OTP has expired.' });
      }

      res.status(200).json({ message: 'OTP verified successfully.' });
    } catch (err) {
      console.error('Error in auth verifyOtp:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  resetPassword: async (req, res) => {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ message: 'Please provide email, OTP, and new password.' });
    }

    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex');

    try {
      const user = await User.findOne({
        where: {
          email,
          resetPasswordToken,
          resetPasswordExpires: { [Sequelize.Op.gt]: Date.now() } // Check if token is not expired
        }
      });

      if (!user) {
        return res.status(400).json({ message: 'Invalid OTP or email, or OTP has expired.' });
      }

      // Set new password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      res.status(200).json({ message: 'Password reset successful.' });

    } catch (err) {
      console.error('Error in auth resetPassword:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  }
};

const sermonController = {
  ...createController(Sermon, 'sermons'),
  getAll: async (req, res) => { // Override to only show published
    try {
      let userId = null;
      if (req.headers.authorization?.startsWith('Bearer')) {
        try {
          const token = req.headers.authorization.split(' ')[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded.id;
        } catch (e) { }
      }

      const sermons = await Sermon.findAll({
        where: { published: true },
        attributes: {
          include: [
            [sequelize.literal('(SELECT COUNT(*) FROM SermonViews WHERE SermonViews.sermon_id = Sermon.id)'), 'views_count'],
            [sequelize.literal('(SELECT COUNT(*) FROM SermonLikes WHERE SermonLikes.sermon_id = Sermon.id)'), 'likes_count'],
            [sequelize.literal('(SELECT COUNT(*) FROM SermonComments WHERE SermonComments.sermon_id = Sermon.id)'), 'comments_count'],
            userId ? [sequelize.literal(`(SELECT COUNT(*) FROM SermonLikes WHERE SermonLikes.sermon_id = Sermon.id AND SermonLikes.user_id = ${userId})`), 'is_liked']
              : [sequelize.literal('0'), 'is_liked']
          ]
        },
        order: [['sermon_date', 'DESC']]
      });
      res.json(sermons);
    } catch (err) {
      console.error('Error in Sermon getAll:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  recordView: async (req, res) => {
    try {
      let userId = null;
      if (req.headers.authorization?.startsWith('Bearer')) {
        try {
          const token = req.headers.authorization.split(' ')[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded.id;
        } catch (e) { }
      }
      await SermonView.create({ sermon_id: req.params.id, user_id: userId });

      if (req.app.get('io')) req.app.get('io').emit('sermon_engagement_updated', { id: req.params.id, type: 'view' });

      res.status(204).send();
    } catch (err) { res.status(500).json({ message: 'Server Error' }); }
  },
  toggleLike: async (req, res) => {
    try {
      const existing = await SermonLike.findOne({ where: { sermon_id: req.params.id, user_id: req.user.id } });
      if (existing) {
        await existing.destroy();
        if (req.app.get('io')) req.app.get('io').emit('sermon_engagement_updated', { id: req.params.id, type: 'like' });
        return res.json({ liked: false });
      }
      await SermonLike.create({ sermon_id: req.params.id, user_id: req.user.id });

      if (req.app.get('io')) req.app.get('io').emit('sermon_engagement_updated', { id: req.params.id, type: 'like' });

      res.json({ liked: true });
    } catch (err) { res.status(500).json({ message: 'Server Error' }); }
  },
  getComments: async (req, res) => {
    try {
      const comments = await SermonComment.findAll({
        where: { sermon_id: req.params.id, parent_id: null },
        include: [
          { model: User, as: 'User', attributes: ['full_name', 'profile_photo_url'] },
          { model: SermonComment, as: 'Replies', include: [{ model: User, as: 'User', attributes: ['full_name', 'profile_photo_url'] }] }
        ],
        order: [['created_date', 'DESC']]
      });
      res.json(comments);
    } catch (err) { res.status(500).json({ message: 'Server Error' }); }
  },
  postComment: async (req, res) => {
    try {
      const comment = await SermonComment.create({ sermon_id: req.params.id, user_id: req.user.id, content: req.body.content, parent_id: req.body.parent_id || null });

      if (req.app.get('io')) req.app.get('io').emit('sermon_engagement_updated', { id: req.params.id, type: 'comment' });

      res.status(201).json(comment);
    } catch (err) { res.status(500).json({ message: 'Server Error' }); }
  }
};

const eventController = {
  ...createController(Event, 'events'),
  getAll: async (req, res) => { // Override to only show published
    try {
      const events = await Event.findAll({
        where: { published: true },
        order: [['event_date', 'ASC']]
      });
      res.json(events);
    } catch (err) {
      console.error('Error in Event getAll:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
};

const announcementController = {
  ...createController(Announcement, 'announcements'),
  getAll: async (req, res) => { // Override to only show published & pinned first
    try {
      const announcements = await Announcement.findAll({
        where: { published: true },
        order: [['pinned', 'DESC'], ['created_date', 'DESC']]
      });
      res.json(announcements);
    } catch (err) {
      console.error('Error in Announcement getAll:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
};

const contactMessageController = {
  ...createController(ContactMessage, 'contact_messages'),
  markAsRead: async (req, res) => {
    try {
      const message = await ContactMessage.findByPk(req.params.id);
      if (!message) return res.status(404).json({ message: 'Message not found' });
      await message.update({ read: true });
      res.json(message);
    } catch (err) {
      console.error('Error in ContactMessage markAsRead:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
};

const donationController = {
  ...createController(Donation, 'donations'),

  getAll: async (req, res) => {
    try {
      // Standard view: users (including admins) see only their own donations.
      // Dashboard view: admins/pastors see everything if they pass the 'all' flag.
      const isAdmin = req.user.role === 'admin' || req.user.role === 'pastor';
      const where = (isAdmin && req.query.all === 'true') ? {} : { donor_email: req.user.email };

      const items = await Donation.findAll({
        where,
        order: [['created_date', 'DESC']]
      });
      res.json(items);
    } catch (err) {
      console.error(`Error in Donation getAll:`, err);
      res.status(500).json({ message: 'Server Error' });
    }
  },

  create: async (req, res) => {
    const { transaction_reference, amount } = req.body;

    if (!transaction_reference) {
      return res.status(400).json({ message: "Transaction reference is required." });
    }

    try {

      const existing = await Donation.findOne({ where: { transaction_reference } });
      if (existing) {
        return res.status(409).json({ message: "This transaction has already been recorded." });
      }


      const paystackResponse = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.paystack.co',
          port: 443,
          path: `/transaction/verify/${encodeURIComponent(transaction_reference)}`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          }
        };

        const apiReq = https.request(options, apiRes => {
          let data = '';
          apiRes.on('data', (chunk) => { data += chunk; });
          apiRes.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch (e) { reject(new Error("Failed to parse Paystack response")); }
          });
        });

        apiReq.on('error', error => { reject(error); });
        apiReq.end();
      });

      if (!paystackResponse.status || paystackResponse.data.status !== 'success') {
        console.error("Paystack verification failed:", paystackResponse);
        return res.status(400).json({ message: "Transaction verification failed." });
      }

      const paidAmount = paystackResponse.data.amount;
      const expectedAmount = Math.round(parseFloat(amount) * 100);
      if (paidAmount < expectedAmount) {
        console.error(`Amount mismatch. Paid: ${paidAmount}, Expected: ${expectedAmount}`);
        return res.status(400).json({ message: `Amount mismatch. Paid: ${paidAmount}, Expected: ${expectedAmount}` });
      }

      const donationPayload = {
        ...req.body,
        status: 'success',
        amount: amount,
      };

      const donation = await Donation.create(donationPayload);
      console.log(`Donation logged successfully: ID ${donation.id} - Ref ${transaction_reference}`);
      if (req.app.get('io')) {
        req.app.get('io').emit('donations_updated');
      }
      res.status(201).json(donation);
    } catch (err) {
      console.error(`Error in Donation create/verify:`, err);
      res.status(500).json({ message: 'Server Error during donation processing.' });
    }
  },

  verify: async (req, res) => {
    const { reference, amount, donor_name, donor_email, donation_type, custom_fund_name } = req.body;

    if (!reference) {
      return res.status(400).json({ message: "Transaction reference is required." });
    }

    try {
      const existing = await Donation.findOne({ where: { transaction_reference: reference } });
      if (existing && existing.status === 'success') {
        console.log(`[Donation] Duplicate reference received, returning existing record: ${reference}`);
        return res.status(200).json({ ...existing.toJSON(), duplicate: true });
      }

      // FIX 2 (Critical): Corrected env var name throughout.
      const paystackResponse = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.paystack.co',
          port: 443,
          path: `/transaction/verify/${encodeURIComponent(reference)}`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        };

        const apiReq = https.request(options, apiRes => {
          let data = '';
          apiRes.on('data', chunk => { data += chunk; });
          apiRes.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch (e) { reject(new Error("Failed to parse Paystack response")); }
          });
        });

        apiReq.on('error', err => reject(err));
        apiReq.end();
      });

      if (!paystackResponse.status || paystackResponse.data?.status !== 'success') {
        console.error('[Donation] Paystack verification failed:', paystackResponse);
        return res.status(400).json({ message: "Transaction verification failed. The payment was not confirmed by Paystack." });
      }

      const txData = paystackResponse.data;

      if (amount) {
        const paidKobo = txData.amount;
        const expectedKobo = Math.round(parseFloat(amount) * 100);
        if (paidKobo < expectedKobo) {
          console.error(`[Donation] Amount mismatch for ${reference}. Paid: ${paidKobo}, Expected: ${expectedKobo}`);
          return res.status(400).json({
            message: `Amount mismatch. Expected KES ${amount} but Paystack reported KES ${paidKobo / 100}.`
          });
        }
      }

      const meta = txData.metadata || {};
      const resolvedDonorName = meta.donor_name || donor_name || 'Anonymous';
      const resolvedDonationType = meta.donation_type || donation_type || 'offering';
      const resolvedCustomFund = meta.custom_fund_name || custom_fund_name || null;
      const resolvedEmail = txData.customer?.email || donor_email;
      const resolvedChannel = txData.channel || 'paystack';
      const resolvedAmount = txData.amount / 100;

      const [donation, created] = await Donation.findOrCreate({
        where: { transaction_reference: reference },
        defaults: {
          donor_name: resolvedDonorName,
          donor_email: resolvedEmail,
          donation_type: resolvedDonationType,
          custom_fund_name: resolvedCustomFund,
          amount: resolvedAmount,
          payment_method: resolvedChannel,
          transaction_reference: reference,
          status: 'success',
        },
      });


      if (!created && donation.status === 'pending') {
        await donation.update({ status: 'success' });
      }

      console.log(`[Donation] ✅ ${created ? 'Created' : 'Updated'} record for ref ${reference} — KES ${resolvedAmount} (${resolvedDonationType})`);

      if (req.app.get('io')) {
        req.app.get('io').emit('donations_updated');
      }

      return res.status(created ? 201 : 200).json(donation);

    } catch (err) {
      console.error('[Donation] verify error:', err);
      return res.status(500).json({ message: 'Server error during donation verification. Please contact support.' });
    }
  },

  webhook: async (req, res) => {
    // FIX 2 (Critical): Corrected env var name.
    const secret = process.env.PAYSTACK_SECRET_KEY;

    if (!secret) {
      console.error('❌ Webhook Error: PAYSTACK_SECRET_KEY is not defined in environment variables.');
      return res.status(500).send('Server configuration error');
    }

    try {

      if (!req.rawBody) {
        console.error('❌ Webhook Error: req.rawBody is missing. Ensure the rawBody middleware is registered before this route.');
        return res.status(500).send('Server configuration error');
      }

      const payload = req.rawBody;

      const hash = crypto
        .createHmac('sha512', secret)
        .update(payload)
        .digest('hex');

      const receivedSig = req.headers['x-paystack-signature'] || '';


      const hashBuf = Buffer.from(hash, 'hex');
      const sigBuf = Buffer.from(receivedSig, 'hex');
      const sigValid = hashBuf.length === sigBuf.length &&
        crypto.timingSafeEqual(hashBuf, sigBuf);

      if (!sigValid) {
        console.warn('⚠️ Webhook Warning: Invalid signature received.');
        return res.sendStatus(400);
      }

      const event = req.body;

      if (event.event === 'charge.success') {
        const { reference, amount, metadata, customer, channel } = event.data;

        try {
          const [donation, created] = await Donation.findOrCreate({
            where: { transaction_reference: reference },
            defaults: {
              donor_name: metadata?.donor_name || 'Anonymous',
              donor_email: customer?.email,
              donation_type: metadata?.donation_type || 'offering',
              custom_fund_name: metadata?.custom_fund_name,
              amount: amount / 100,
              payment_method: channel,
              status: 'success',
            }
          });

          if (!created && donation.status !== 'success') {
            await donation.update({ status: 'success' });
          }

          console.log(`✅ Webhook: Transaction ${reference} verified successfully.`);

          const io = req.app.get('io');
          if (io) {
            io.emit('donations_updated');
          }
        } catch (dbError) {
          console.error('❌ Webhook Database Error:', dbError);
          // Return 200 so Paystack stops retrying, but log for manual review.
        }
      }

      return res.sendStatus(200);

    } catch (cryptoError) {
      console.error('❌ Webhook Processing Error:', cryptoError);
      return res.sendStatus(500);
    }
  }
};
const mediaItemController = createController(MediaItem, 'media');
const userController = {
  ...createController(User, 'users'),
  // Override to exclude password hash from lists
  getAll: async (req, res) => {
    try {
      const users = await User.findAll({
        attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] },
        order: [['full_name', 'ASC']]
      });
      res.json(users);
    } catch (err) {
      console.error(`Error in User getAll:`, err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  // Override update to prevent password/token fields from being set via this route
  update: async (req, res) => {
    try {
      const item = await User.findByPk(req.params.id);
      if (!item) return res.status(404).json({ message: 'Item not found' });
      const { password, resetPasswordToken, resetPasswordExpires, ...safeData } = req.body;
      await item.update(safeData);

      // REAL-TIME BAN ENFORCEMENT: Kick the user immediately if they are banned
      if (safeData.is_banned === true && req.app.get('io')) {
        const io = req.app.get('io');
        for (const [id, s] of io.sockets.sockets) {
          if (s.user && s.user.id === item.id) {
            s.emit('account_suspended', { message: 'Your account has been suspended by an administrator.' });
            s.disconnect(true);
          }
        }
      }

      const updated = await User.findByPk(req.params.id, {
        attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] }
      });
      if (req.app.get('io')) req.app.get('io').emit('users_updated');
      res.json(updated);
    } catch (err) {
      console.error(`Error in User update:`, err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
};
const rsvpController = createController(RSVP, 'rsvps');
const chatMessageController = {
  ...createController(ChatMessage, 'chat'),
  getAll: async (req, res) => {
    try {
      const { channel } = req.query;
      // If a channel is specified, filter by it. Otherwise, return nothing or default to general.
      // This prevents support_ messages from leaking into the 'general' history fetch.
      const where = channel ? { channel } : { channel: 'general' };

      const items = await ChatMessage.findAll({
        where,
        order: [['created_date', 'DESC']],
        limit: 100
      });
      res.json(items);
    } catch (err) {
      console.error(`Error in ChatMessage getAll:`, err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
};

const chatGroupController = {
  ...createController(ChatGroup, 'chat-groups'),
  getAll: async (req, res) => {
    try {
      const groups = await ChatGroup.findAll({
        include: [{ model: User, attributes: ['id', 'full_name', 'email'], through: { attributes: [] } }], // Don't include join table attributes
        order: [['name', 'ASC']]
      });
      res.json(groups);
    } catch (err) {
      console.error(`Error in ChatGroup getAll:`, err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  getMyGroups: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, {
        include: [{
          model: ChatGroup,
          through: { attributes: [] }
        }]
      });
      res.json(user ? user.ChatGroups : []);
    } catch (err) {
      console.error(`Error in ChatGroup getMyGroups:`, err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  leaveGroup: async (req, res) => {
    try {
      const group = await ChatGroup.findByPk(req.params.id);
      // User comes from the 'protect' middleware
      const user = await User.findByPk(req.user.id);

      if (!group) return res.status(404).json({ message: 'Group not found' });
      if (!user) return res.status(404).json({ message: 'User not found' });

      await group.removeUser(user);
      res.status(200).json({ message: 'You have left the group.' });
    } catch (err) {
      console.error(`Error in ChatGroup leaveGroup:`, err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  addMember: async (req, res) => {
    try {
      const group = await ChatGroup.findByPk(req.params.id);
      const user = await User.findByPk(req.body.userId);
      if (!group || !user) return res.status(404).json({ message: 'Group or User not found' });
      await group.addUser(user);
      res.status(200).json({ message: 'Member added' });
    } catch (err) {
      res.status(500).json({ message: 'Server Error' });
    }
  },
  removeMember: async (req, res) => {
    try {
      const group = await ChatGroup.findByPk(req.params.id);
      const user = await User.findByPk(req.params.userId);
      if (!group || !user) return res.status(404).json({ message: 'Group or User not found' });
      await group.removeUser(user);
      res.status(200).json({ message: 'Member removed' });
    } catch (err) {
      res.status(500).json({ message: 'Server Error' });
    }
  },
};

const pushController = {
  subscribe: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      await user.update({ push_subscription: JSON.stringify(req.body) });
      res.status(200).json({ message: 'Push subscription saved' });
    } catch (err) {
      console.error('Push Subscribe Error:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
  test: async (req, res) => {
    try {
      await sendPushToUser(req.user.id, {
        title: '🔔 MUTSDA Test',
        body: 'Hallelujah! Your push notifications are now active and working correctly.',
        url: '/memberprofile'
      });
      res.status(200).json({ message: 'Test notification sent' });
    } catch (err) {
      console.error('Push Test Error:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  }
};

/**
 * Reusable helper to send push notifications.
 * Automatically clears push_subscription from the User record if the endpoint is dead.
 */
const sendPushToUser = async (userId, payload) => {
  try {
    const user = await User.findByPk(userId);
    if (!user || !user.push_subscription || !user.push_notifications_enabled) return;

    const subscription = JSON.parse(user.push_subscription);
    await webPush.sendNotification(subscription, JSON.stringify(payload));
  } catch (err) {
    // 404 (Not Found) or 410 (Gone) status codes mean the subscription is no longer valid
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.log(`[Push] Subscription for user ${userId} is dead. Cleaning up...`);
      await User.update({ push_subscription: null }, { where: { id: userId } });
    } else {
      console.error(`[Push] Unexpected error for user ${userId}:`, err.message);
    }
  }
};

// -----------------------------------------------------------------------------
// 7. API ROUTES (from /routes)
// -----------------------------------------------------------------------------

const authRouter = express.Router();
authRouter.put('/me', protect, authController.updateMe);
authRouter.put('/change-password', protect, authController.changePassword);
authRouter.post('/me/photo', protect, upload.single('photo'), async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (user && req.file) {
      // Construct the URL to be stored
      const fileUrl = req.file.path;
      await user.update({ profile_photo_url: fileUrl });
      res.json({ file_url: fileUrl });
    } else {
      res.status(404).json({ message: 'User not found or file not uploaded' });
    }
  } catch (err) {
    console.error('Error in photo upload:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});
authRouter.post('/invite', protect, admin, authController.invite);
authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
authRouter.post('/google', authController.googleLogin);
authRouter.get('/me', protect, authController.getMe);
authRouter.post('/forgot-password', authController.forgotPassword);
authRouter.post('/verify-otp', authController.verifyOtp);
authRouter.post('/reset-password', authController.resetPassword);
authRouter.post('/push-subscribe', protect, pushController.subscribe);
authRouter.post('/push-test', protect, pushController.test);

const sermonRouter = express.Router();
sermonRouter.get('/', sermonController.getAll); // Public
sermonRouter.get('/:id', sermonController.getById); // Public
sermonRouter.post('/:id/view', sermonController.recordView);
sermonRouter.post('/:id/like', protect, sermonController.toggleLike);
sermonRouter.get('/:id/comments', sermonController.getComments);
sermonRouter.post('/:id/comments', protect, sermonController.postComment);
sermonRouter.post('/', protect, admin, sermonController.create);
sermonRouter.put('/:id', protect, admin, sermonController.update);
sermonRouter.delete('/:id', protect, admin, sermonController.delete);

const eventRouter = express.Router();
eventRouter.get('/', eventController.getAll); // Public
eventRouter.get('/:id', eventController.getById); // Public
eventRouter.post('/', protect, admin, eventController.create);
eventRouter.put('/:id', protect, admin, eventController.update);
eventRouter.delete('/:id', protect, admin, eventController.delete);

const announcementRouter = express.Router();
announcementRouter.get('/', announcementController.getAll); // Public
announcementRouter.post('/', protect, admin, announcementController.create);
announcementRouter.put('/:id', protect, admin, announcementController.update);
announcementRouter.delete('/:id', protect, admin, announcementController.delete);

const donationRouter = express.Router();
donationRouter.post('/webhook', donationController.webhook);           // Paystack webhook (no auth)
donationRouter.post('/verify', donationController.verify);             // Frontend verify-and-save (public)
donationRouter.get('/', protect, donationController.getAll);    // Admin only
donationRouter.post('/', donationController.create);                   // Legacy create (public)

const mediaItemRouter = express.Router();
mediaItemRouter.get('/', mediaItemController.getAll); // Public
mediaItemRouter.post('/', protect, admin, mediaItemController.create);
mediaItemRouter.delete('/:id', protect, admin, mediaItemController.delete);

const contactMessageRouter = express.Router();
contactMessageRouter.get('/', protect, admin, contactMessageController.getAll); // Admin only
contactMessageRouter.post('/', contactMessageController.create); // Public
contactMessageRouter.put('/:id/read', protect, admin, contactMessageController.markAsRead);

const userRouter = express.Router(); // For admin to manage users
userRouter.get('/', protect, userController.getAll);
userRouter.get('/:id', protect, admin, userController.getById);
userRouter.put('/:id', protect, admin, userController.update);
userRouter.delete('/:id', protect, admin, userController.delete);

const rsvpRouter = express.Router();
rsvpRouter.get('/', protect, rsvpController.getAll);
rsvpRouter.post('/', protect, rsvpController.create);

const chatRouter = express.Router();
chatRouter.get('/', protect, chatMessageController.getAll); // Get all messages for a channel
chatRouter.post('/upload', protect, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const fileUrl = req.file.path;
  const mimeType = req.file.mimetype;
  let mediaType = 'file';
  if (mimeType.startsWith('image/')) mediaType = 'image'; // includes gifs
  else if (mimeType.startsWith('video/')) mediaType = 'video';
  else if (mimeType.startsWith('audio/')) mediaType = 'audio';

  res.json({ file_url: fileUrl, url: fileUrl, mediaType, filename: req.file.originalname });
});

const chatGroupRouter = express.Router();
chatGroupRouter.get('/', protect, admin, chatGroupController.getAll);
chatGroupRouter.get('/mine', protect, chatGroupController.getMyGroups);
chatGroupRouter.post('/', protect, admin, chatGroupController.create);
chatGroupRouter.put('/:id', protect, admin, chatGroupController.update);
chatGroupRouter.delete('/:id', protect, admin, chatGroupController.delete);
chatGroupRouter.post('/:id/members', protect, admin, chatGroupController.addMember);
chatGroupRouter.delete('/:id/leave', protect, chatGroupController.leaveGroup);
chatGroupRouter.delete('/:id/members/:userId', protect, admin, chatGroupController.removeMember);

// ── Direct Message REST routes (history fetch) ─────────────────────────────
const dmRouter = express.Router();

// GET /api/dm/:channelId — fetch conversation history between two users
dmRouter.get('/:channelId', protect, async (req, res) => {
  try {
    const { channelId } = req.params;
    // Security: ensure the requesting user is actually part of this DM channel.
    // Channel format: dm_<email1>_<email2> where emails are sorted.
    if (!channelId.startsWith('dm_')) {
      return res.status(400).json({ message: 'Invalid DM channel ID.' });
    }
    const userEmail = req.user.email;
    if (!channelId.includes(userEmail)) {
      return res.status(403).json({ message: 'Access denied to this conversation.' });
    }

    const messages = await DirectMessage.findAll({
      where: { channel: channelId },
      order: [['created_date', 'ASC']],
      limit: 100,
    });
    res.json(messages);
  } catch (err) {
    console.error('[DM] fetch error:', err);
    res.status(500).json({ message: 'Failed to load messages.' });
  }
});

// PATCH /api/dm/:channelId/read — mark messages as read
dmRouter.patch('/:channelId/read', protect, async (req, res) => {
  try {
    const { channelId } = req.params;
    await DirectMessage.update(
      { read: true },
      { where: { channel: channelId, recipient_email: req.user.email, read: false } }
    );
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark as read.' });
  }
});

const coreRouter = express.Router();
coreRouter.post('/send-email', async (req, res) => {
  const { to, subject, body } = req.body;
  // Basic input validation
  if (!to || !subject || !body) {
    return res.status(400).json({ message: 'to, subject, and body are required.' });
  }
  // Validate recipient is a plausible email address
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ message: 'Invalid recipient email address.' });
  }
  try {
    const textVersion = body.replace(/<[^>]*>?/gm, ''); // Simple conversion to text
    const html = createStyledEmail(subject, body);

    await sendEmail({
      email: to,
      subject: subject,
      message: textVersion,
      html: html
    });
    res.status(200).json({ message: "Email sent successfully." });
  } catch (error) {
    console.error("Email send error:", error);
    res.status(500).json({ message: "Failed to send email" });
  }
});

// -----------------------------------------------------------------------------
// 7c. AI PASTOR CHAT (Gemini API)
// -----------------------------------------------------------------------------

const aiChatRouter = express.Router();

// GET /api/ai-chat/history — last 40 messages for the logged-in user
aiChatRouter.get('/history', protect, async (req, res) => {
  try {
    const messages = await AiChatMessage.findAll({
      where: { user_email: req.user.email },
      order: [['created_date', 'ASC']],
      limit: 60,
    });
    res.json(messages);
  } catch (err) {
    console.error('[AI Chat] history error:', err);
    res.status(500).json({ message: 'Failed to load AI chat history.' });
  }
});

// DELETE /api/ai-chat/history — clear the user's conversation
aiChatRouter.delete('/history', protect, async (req, res) => {
  try {
    await AiChatMessage.destroy({ where: { user_email: req.user.email } });
    res.json({ message: 'Conversation cleared.' });
  } catch (err) {
    console.error('[AI Chat] clear error:', err);
    res.status(500).json({ message: 'Failed to clear conversation.' });
  }
});

// POST /api/ai-chat — send a message and get Gemini reply
aiChatRouter.post('/', protect, async (req, res) => {
  const { message, session_id, history: clientHistory } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ message: 'Message is required.' });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(503).json({ message: 'AI service is not configured. Please contact an admin.' });
  }

  try {
    // 1. Save the user's message
    await AiChatMessage.create({
      user_email: req.user.email,
      role: 'user',
      content: message.trim(),
      session_id: session_id || null,
    });

    // 2. Build Gemini history.
    //    Prefer the full in-memory history sent by the client (always up-to-date
    //    and avoids an extra DB round-trip). Fall back to a DB query only when
    //    the client sends nothing (e.g. older clients or direct API calls).
    let geminiHistory;

    if (Array.isArray(clientHistory) && clientHistory.length > 0) {
      // Client sends every prior turn before the new user message.
      // Gemini requires strictly alternating user/model turns — enforce that by
      // keeping only valid entries and skipping any consecutive same-role pairs.
      const cleaned = [];
      for (const turn of clientHistory) {
        if (!turn.role || !turn.content) continue;
        if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === turn.role) continue;
        cleaned.push(turn);
      }
      // Gemini must start with a 'user' turn
      const startIdx = cleaned.findIndex(t => t.role === 'user');
      geminiHistory = (startIdx >= 0 ? cleaned.slice(startIdx) : cleaned)
        .slice(-30) // cap at 30 turns (~15 exchanges) to stay within token limits
        .map(t => ({ role: t.role, parts: [{ text: t.content }] }));
    } else {
      // Fallback: load last 20 saved turns from DB
      const dbHistory = await AiChatMessage.findAll({
        where: { user_email: req.user.email },
        order: [['created_date', 'DESC']],
        limit: 21,
      });
      dbHistory.reverse();
      // Exclude the message we just saved (last entry) — it goes in separately below
      geminiHistory = dbHistory.slice(0, -1).map(m => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));
    }

    // 3. System instruction
    const systemInstruction = {
      parts: [{
        text: `You are "MUTSDA AI", a warm, wise, and compassionate spiritual companion for members of the MUTSDA Seventh-day Adventist Church community.

Your purpose is to:
• Guide users through Bible questions with clear, scripture-backed answers (always cite chapter and verse)
• Offer hope, encouragement, and comfort grounded in God's Word
• Discuss prayer, faith, spiritual growth, Adventist beliefs, and Christian living
• Share relevant Bible stories, devotional thoughts, and practical spiritual advice
• Pray with users when they ask, using heartfelt and biblical language
• Discuss topics like forgiveness, anxiety, grief, marriage, family, purpose, and salvation

Guidelines:
• Always be warm, gentle, and non-judgmental
• Base every answer firmly on Scripture — quote directly when helpful
• If a question falls outside spiritual/biblical/religious topics, kindly redirect: "I'm here to help with spiritual matters — let's explore what God's Word says!"
• Never give medical, legal, or financial advice
• Encourage professional or pastoral help for serious personal crises
• Keep answers focused and digestible — use short paragraphs and occasional Scripture quotes
• End responses with a short encouraging Scripture verse when appropriate

The current user's name is: ${req.user.full_name || 'Friend'}.`
      }]
    };

    // 4. Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const geminiBody = {
      system_instruction: systemInstruction,
      contents: [
        ...geminiHistory,
        { role: 'user', parts: [{ text: message.trim() }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    };

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error('[AI Chat] Gemini API error:', geminiData);
      return res.status(502).json({ message: 'AI service returned an error. Please try again.' });
    }

    const aiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) {
      return res.status(502).json({ message: 'No response from AI. Please try again.' });
    }

    // 5. Save the AI response
    const aiMsg = await AiChatMessage.create({
      user_email: req.user.email,
      role: 'model',
      content: aiText,
      session_id: session_id || null,
    });

    res.json({ reply: aiText, messageId: aiMsg.id });
  } catch (err) {
    console.error('[AI Chat] error:', err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

// -----------------------------------------------------------------------------
// 8. MOUNT ROUTES
// -----------------------------------------------------------------------------

app.use('/api/auth', authRouter);
app.use('/api/sermons', sermonRouter);
app.use('/api/events', eventRouter);
app.use('/api/announcements', announcementRouter);
app.use('/api/donations', donationRouter);
app.use('/api/media', mediaItemRouter);
app.use('/api/contact', contactMessageRouter);
app.use('/api/users', userRouter);
app.use('/api/rsvps', rsvpRouter);
app.use('/api/chatmessages', chatRouter);
app.use('/api/chat-groups', chatGroupRouter);
app.use('/api/dm', protect, dmRouter);
app.use('/api/core', protect, admin, coreRouter);
app.use('/api/ai-chat', aiChatRouter);

// -----------------------------------------------------------------------------
// 8b. JAAS (8x8.vc) JWT TOKEN ENDPOINT
// -----------------------------------------------------------------------------
//
// Required environment variables (.env):
//
//   JAAS_APP_ID        — Your JaaS App ID from https://jaas.8x8.vc
//                        Example: "vpaas-magic-cookie-abc123def456/SomeAppId"
//
//   JAAS_PRIVATE_KEY   — Your RS256 private key, base64-encoded.
//                        Steps to encode your downloaded .pem file:
//                          Linux/Mac:  base64 -w 0 your-key.pem
//                          Windows:    certutil -encode your-key.pem out.txt
//                        Copy the resulting single-line string into .env.
//                        The route below decodes it back to PEM at runtime.
//
//   JAAS_KID           — Your JaaS key ID (found on the JaaS dashboard next
//                        to the key you downloaded). Format: "APP_ID/KEY_ID"
//                        Example: "vpaas-magic-cookie-abc123def456/abcd1234"
//
// How to obtain these values:
//   1. Log in at https://jaas.8x8.vc
//   2. Go to Settings → API Keys
//   3. Click "Generate new key pair" — this downloads your private key (.pem)
//      and shows the Key ID on screen.
//   4. Your App ID is the string at the top of the Settings page.
//
// Security notes:
//   • NEVER commit the private key or .env to version control.
//   • Tokens are short-lived (90 minutes) and scoped to a specific room.
//   • Only authenticated users (via your existing 'protect' middleware) can
//     call this endpoint. Guests cannot obtain a token and join as attendees.
//   • The 'moderator' claim is derived server-side from req.user.role — the
//     frontend cannot forge it.
// -----------------------------------------------------------------------------

const jaasRouter = express.Router();

jaasRouter.post('/token', protect, async (req, res) => {
  const { roomName, isModerator } = req.body;

  // ── 1. Validate environment ───────────────────────────────────────────────
  const appId = process.env.JAAS_APP_ID;
  const kid = process.env.JAAS_KID;
  const privateKeyB64 = process.env.JAAS_PRIVATE_KEY;

  if (!appId || !kid || !privateKeyB64) {
    console.error('[JaaS] Missing env vars: JAAS_APP_ID, JAAS_KID, or JAAS_PRIVATE_KEY');
    return res.status(503).json({
      message: 'JaaS is not configured on this server. Please contact an administrator.'
    });
  }

  if (!roomName || typeof roomName !== 'string' || roomName.trim() === '') {
    return res.status(400).json({ message: 'roomName is required.' });
  }

  // ── 2. Derive moderator status from the DB — never trust the client ───────
  //   The frontend sends isModerator as a hint, but we re-derive it here from
  //   the authenticated user's role to prevent privilege escalation.
  const serverSideModerator =
    req.user.role === 'admin' || req.user.role === 'pastor';

  // ── 3. Decode the private key from base64 → PEM ───────────────────────────
  let privateKeyPem;
  try {
    privateKeyPem = Buffer.from(privateKeyB64, 'base64').toString('utf8');
  } catch (err) {
    console.error('[JaaS] Failed to decode JAAS_PRIVATE_KEY from base64:', err);
    return res.status(500).json({ message: 'Server configuration error.' });
  }

  // ── 4. Build the JaaS JWT payload ────────────────────────────────────────
  //   Spec: https://developer.8x8.com/jaas/docs/api-keys-jwt
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: 'chat',              // JaaS requires the literal string "chat"
    aud: 'jitsi',             // JaaS requires the literal string "jitsi"
    sub: appId,               // Your JaaS App ID
    room: '*',                // '*' allows the token to be used for any room
    // Replace with roomName for tighter per-room scoping
    iat: now,
    exp: now + (90 * 60),    // Token valid for 90 minutes

    context: {
      user: {
        id: String(req.user.id),
        name: req.user.full_name || 'MUTSDA Member',
        email: req.user.email || '',
        avatar: req.user.profile_photo_url || '',
        moderator: serverSideModerator,
      },
      features: {
        livestreaming: serverSideModerator,   // Only moderators can start streams
        recording: serverSideModerator,   // Only moderators can record
        transcription: false,
        'outbound-call': false,
      },
    },
  };

  // ── 5. Sign the token with RS256 ──────────────────────────────────────────
  try {
    const token = jwt.sign(payload, privateKeyPem, {
      algorithm: 'RS256',
      header: {
        alg: 'RS256',
        kid,              // JaaS uses this to look up the matching public key
        typ: 'JWT',
      },
    });

    console.log(
      `[JaaS] Token issued for user ${req.user.email} | room: ${roomName} | moderator: ${serverSideModerator}`
    );

    return res.json({ token, moderator: serverSideModerator });
  } catch (err) {
    console.error('[JaaS] jwt.sign failed:', err.message);
    return res.status(500).json({ message: 'Failed to generate meeting token.' });
  }
});

app.use('/api/jaas', jaasRouter);

// Legacy DM history route — prefer /api/dm/:channelId which has stricter validation.
// Kept for backwards compatibility but now enforces channel membership.
app.get('/api/direct-messages/:channel', protect, async (req, res) => {
  try {
    const { channel } = req.params;
    // Enforce that the requesting user is a participant of this channel
    if (!channel.startsWith('dm_') || !channel.includes(req.user.email)) {
      return res.status(403).json({ message: 'Access denied to this conversation.' });
    }
    const messages = await DirectMessage.findAll({
      where: { channel },
      order: [['created_date', 'ASC']],
      limit: 100
    });
    res.json(messages);
  } catch (err) {
    console.error("Error fetching DM history:", err);
    res.status(500).json({ message: "Could not load messages" });
  }
});
// -----------------------------------------------------------------------------
// 9. SOCKET.IO for Live Chat
// -----------------------------------------------------------------------------

const supportQueue = []; // Array of { id, name, email, socketId }
let activeSupportSessions = []; // Array of { adminSocketId, userSocketId, room, user }
const onlineUsers = new Map(); // Map<socket.id, userObject>
let currentTickerState = { message: "", textColor: "#1a2744", backgroundColor: "#c8a951", speed: 95 }; // Store the active news ticker message and color
let currentTextOverlayState = { text: "", fontSize: 32, isVisible: false, isFullScreen: false, backgroundImage: "", backgroundColor: "#1a2744", backgroundOpacity: 0.8 }; // Store text overlay state
const activeStreams = new Set();
const broadcasters = {}; // streamId -> socketId
const streamViewers = new Map(); // streamId -> Map<socketId, lastHeartbeatTimestamp>

const io = new Server(server, {
  cors: corsOptions,
});

// ---------------------------------------------------------------------------
// Socket.IO Authentication Middleware
// Clients must pass a valid JWT in the handshake: socket({ auth: { token } })
// Unauthenticated connections are still allowed but socket.user will be null.
// Admin-only events below check socket.user?.role before acting.
// ---------------------------------------------------------------------------
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
      if (user) {
        // Refuse connection if user is already banned
        if (user.is_banned) return next(new Error('Account suspended'));
        socket.user = user;
      }
    } catch {
      // Invalid token — socket continues as unauthenticated
    }
  }
  next();
});

// Helper: only allow admin/pastor roles on privileged socket events
const requireSocketAdmin = (socket, eventName) => {
  if (!socket.user || (socket.user.role !== 'admin' && socket.user.role !== 'pastor')) {
    console.warn(`[Socket] Unauthorized '${eventName}' attempt from socket ${socket.id}`);
    socket.emit('error', { message: 'Not authorized.' });
    return false;
  }
  return true;
};

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Middleware to verify admin roles for specific sensitive events
  socket.use(([event], next) => {
    const adminEvents = [
      'admin_update_ticker',
      'admin_update_text_overlay',
      'broadcaster',
      'admin_listening',
      'admin_accept_chat',
      'admin_end_chat'
    ];

    if (adminEvents.includes(event) && !requireSocketAdmin(socket, event)) {
      return next(new Error('Unauthorized: Admin access required.'));
    }
    next();
  });

  // Watchdog: Clean up stale viewers periodically
  if (!io.watchdogInterval) {
    io.watchdogInterval = setInterval(() => {
      const now = Date.now();
      streamViewers.forEach((viewers, streamId) => {
        let changed = false;
        viewers.forEach((lastSeen, socketId) => {
          if (now - lastSeen > 30000) { // Remove if no heartbeat for 30s
            viewers.delete(socketId);
            changed = true;
          }
        });
        if (changed) {
          broadcastViewerCount(streamId);
        }
      });
    }, 10000); // Check every 10s
  }

  socket.on('join', (room) => {
    socket.join(room);
  });

  socket.on('leave', (room) => {
    socket.leave(room);
    console.log(`Socket ${socket.id} left room ${room}`);
  });

  // --- NEWS TICKER ---
  socket.emit('ticker_update', currentTickerState); // Send current ticker to new connection
  socket.emit('text_overlay_update', currentTextOverlayState); // Send current text overlay to new connection

  socket.on('admin_update_ticker', (newState) => {
    currentTickerState = { ...currentTickerState, ...newState };
    io.emit('ticker_update', currentTickerState); // Broadcast to all
    console.log(`Ticker updated:`, currentTickerState);
  });

  socket.on('admin_update_text_overlay', (newState) => {
    currentTextOverlayState = { ...currentTextOverlayState, ...newState };
    io.emit('text_overlay_update', currentTextOverlayState); // Broadcast to all
    console.log(`Text overlay updated:`, newState);
  });

  // --- LIVE STREAMING SIGNALING ---
  socket.on('get_live_streams', () => {
    socket.emit('live_streams_update', Array.from(activeStreams));
  });

  socket.on('broadcaster', (streamId) => {
    if (broadcasters[streamId] && broadcasters[streamId] !== socket.id) {
      // Stream is already active by another socket
      socket.emit('stream_error', { message: 'Stream is already active by another admin.' });
      return;
    }
    broadcasters[streamId] = socket.id;
    activeStreams.add(streamId);
    socket.streamId = streamId;
    socket.broadcast.emit('broadcaster');
    io.emit('live_streams_update', Array.from(activeStreams));
    console.log(`Stream started: ${streamId}`);
  });

  const broadcastViewerCount = (streamId) => {
    const viewers = streamViewers.get(streamId);
    const count = viewers ? viewers.size : 0;
    const broadcasterId = broadcasters[streamId];
    if (broadcasterId) {
      io.to(broadcasterId).emit('viewer_count', count);
    }
    // Also emit to all viewers in the stream room
    io.to(`stream_viewers_${streamId}`).emit('viewer_count', count);
  };

  socket.on('watcher', (streamId) => {
    const broadcasterId = broadcasters[streamId];
    if (broadcasterId) {
      io.to(broadcasterId).emit('watcher', socket.id);
    }

    // Add to viewers tracking
    if (!streamViewers.has(streamId)) {
      streamViewers.set(streamId, new Map());
    }
    streamViewers.get(streamId).set(socket.id, Date.now());
    socket.join(`stream_viewers_${streamId}`);
    broadcastViewerCount(streamId);
  });

  socket.on('stream_heartbeat', (streamId) => {
    if (streamViewers.has(streamId)) {
      const viewers = streamViewers.get(streamId);
      // Only update if the viewer is already tracked (or re-add them)
      if (viewers) {
        viewers.set(socket.id, Date.now());
        // If they weren't in the room for some reason, join them
        socket.join(`stream_viewers_${streamId}`);
      }
    }
  });

  socket.on('offer', (id, message) => {
    io.to(id).emit('offer', socket.id, message);
  });

  socket.on('answer', (id, message) => {
    io.to(id).emit('answer', socket.id, message);
  });

  socket.on('candidate', (id, message) => {
    io.to(id).emit('candidate', socket.id, message);
  });

  // Admin is online and ready for support
  socket.on('admin_listening', () => {
    console.log(`Admin ${socket.id} is listening for support.`);
    socket.join('admins');
    socket.emit('support_queue_update', supportQueue);
  });

  // User requests live support
  socket.on('request_support', (user) => {
    // Check if any admin is actually online
    const adminRoom = io.sockets.adapter.rooms.get('admins');
    if (!adminRoom || adminRoom.size === 0) {
      socket.emit('error', { message: 'No administrators are currently online. Please try again later or leave a message.' });
    }

    // Avoid adding duplicates to the queue
    if (!supportQueue.some(u => u.id === user.id)) {
      console.log(`User ${user.name} (${socket.id}) requested support.`);
      supportQueue.push({ ...user, socketId: socket.id });
      io.to('admins').emit('support_queue_update', supportQueue);
      socket.emit('support_request_queued');
    }
  });

  // Admin accepts a chat from the queue
  socket.on('admin_accept_chat', (data) => {
    const targetUser = data.user || data;
    const adminName = data.adminName || 'Support Admin';

    const userIndex = supportQueue.findIndex(u => u.socketId === targetUser.socketId);
    const userToChat = supportQueue[userIndex];

    if (userToChat) {
      supportQueue.splice(userIndex, 1);

      const room = `support_${userToChat.id}`;
      const newSession = {
        adminSocketId: socket.id,
        userSocketId: userToChat.socketId,
        room: room,
        user: userToChat
      };
      activeSupportSessions.push(newSession);

      const userSocket = io.sockets.sockets.get(userToChat.socketId);
      if (userSocket) {
        userSocket.join(room);
        socket.join(room);

        userSocket.emit('support_session_started', { adminName });
        socket.emit('support_session_started', { userName: userToChat.name, room: room, user: userToChat });

        io.to('admins').emit('support_queue_update', supportQueue);
        console.log(`Admin ${socket.id} (${adminName}) started support session with ${userToChat.name} in room ${room}`);
      }
    }
  });

  // Admin ends a chat session
  socket.on('admin_end_chat', () => {
    const sessionIndex = activeSupportSessions.findIndex(s => s.adminSocketId === socket.id);
    if (sessionIndex !== -1) {
      const { room, userSocketId } = activeSupportSessions[sessionIndex];
      console.log(`Admin ${socket.id} ended support session in room ${room}.`);

      io.to(room).emit('support_session_ended', { message: 'The admin has ended the chat session.' });

      const userSocket = io.sockets.sockets.get(userSocketId);
      if (userSocket) userSocket.leave(room);
      socket.leave(room);

      activeSupportSessions.splice(sessionIndex, 1);
    }
  });

  socket.on('i_am_online', (user) => {
    if (user) {
      // Update last active status in DB
      User.update({ last_active: new Date() }, { where: { id: user.id } }).catch(() => { });

      onlineUsers.set(socket.id, {
        id: user.id,
        name: user.full_name,
        email: user.email,
        profile_photo_url: user.profile_photo_url,
      });
      const uniqueUsers = Array.from(
        new Map(Array.from(onlineUsers.values()).map(u => [u.email, u])).values()
      );
      io.to('general').emit('online_users_update', uniqueUsers);
    }
  });

  socket.on('sendMessage', async (data) => {
    try {
      if (data.channel && data.channel.startsWith('support_')) {
        // Support chat
        const message = { ...data, created_date: new Date() };
        io.to(data.channel).emit('newMessage', message);
        await ChatMessage.create(data);

      } else if (data.channel && data.channel.startsWith('dm_')) {
        // ── Private Direct Message ──────────────────────────────────────────
        // Derive the recipient email from the channel key
        // Channel format: dm_<emailA>_<emailB> (sorted). We already know sender.
        const channelParts = data.channel.replace('dm_', '').split('_');
        // The channel is formed by sorting two emails — find the other one
        // Simple approach: strip sender_email prefix/suffix to get recipient
        const recipientEmail = [data.sender_email].reduce((acc, se) => {
          // Remove sender email from the channel string to get recipient
          const withoutPrefix = data.channel.replace('dm_', '');
          // Both emails are joined, sorted. Split on the sender email.
          if (withoutPrefix.startsWith(se + '_')) return withoutPrefix.slice(se.length + 1);
          if (withoutPrefix.endsWith('_' + se)) return withoutPrefix.slice(0, withoutPrefix.length - se.length - 1);
          return acc;
        }, '');

        const { replyTo, ...messageData } = data;
        const payload = {
          ...messageData,
          recipient_email: recipientEmail
        };

        if (replyTo && replyTo.id) {
          payload.reply_to_message_id = replyTo.id;
          payload.reply_to_sender_name = replyTo.sender_name;
          let snippet = replyTo.message;
          if (snippet && snippet.length > 120) snippet = snippet.substring(0, 117) + '...';
          payload.reply_to_message_snippet = snippet || (replyTo.media_url ? (replyTo.media_filename || 'Attachment') : '');
        }

        const dmRecord = await DirectMessage.create(payload);

        io.to(data.channel).emit('newMessage', dmRecord);

      } else {
        // General / group community chat
        const { replyTo, ...messageData } = data;
        if (replyTo && replyTo.id) {
          messageData.reply_to_message_id = replyTo.id;
          messageData.reply_to_sender_name = replyTo.sender_name;
          let snippet = replyTo.message;
          if (snippet && snippet.length > 120) snippet = snippet.substring(0, 117) + '...';
          messageData.reply_to_message_snippet = snippet || (replyTo.media_url ? (replyTo.media_filename || 'Attachment') : '');
        }
        const message = await ChatMessage.create(messageData);
        io.to(data.channel || 'general').emit('newMessage', message);
      }
    } catch (err) {
      console.error('Socket sendMessage error:', err);
    }
  });

  socket.on('deleteMessage', async (data) => {
    try {
      const { messageId } = data;
      if (!messageId) {
        socket.emit('deleteError', { message: 'Invalid request.' });
        return;
      }

      // Use server-verified identity instead of trusting the client-supplied userEmail
      if (!socket.user) {
        socket.emit('deleteError', { message: 'Authentication required.' });
        return;
      }

      const user = socket.user;

      // Try to find in ChatMessage first, then DirectMessage
      let message = await ChatMessage.findByPk(messageId);
      let model = ChatMessage;

      if (!message) {
        message = await DirectMessage.findByPk(messageId);
        model = DirectMessage;
      }

      if (!message) return;

      const canDelete = user.role === 'admin' || user.email === message.sender_email;

      if (canDelete) {
        await message.destroy();
        io.to(message.channel).emit('messageDeleted', {
          messageId: message.id,
          channel: message.channel
        });
      } else {
        socket.emit('deleteError', { message: 'You do not have permission to delete this message.' });
      }
    } catch (err) {
      console.error('Socket deleteMessage error:', err);
      socket.emit('deleteError', { message: 'An error occurred while deleting the message.' });
    }
  });

  socket.on('editMessage', async (data) => {
    try {
      const { messageId, newMessage } = data;
      if (!messageId || !newMessage) return;

      // Use the server-verified identity — never trust a userEmail from the client payload
      if (!socket.user) {
        socket.emit('error', { message: 'Authentication required to edit messages.' });
        return;
      }
      const userEmail = socket.user.email;

      let message = await ChatMessage.findByPk(messageId);
      if (!message) {
        message = await DirectMessage.findByPk(messageId);
      }

      if (!message) return;

      // Check if user is the sender
      if (message.sender_email !== userEmail) {
        socket.emit('error', { message: 'You can only edit your own messages.' });
        return;
      }

      await message.update({ message: newMessage });
      io.to(message.channel).emit('messageUpdated', {
        id: message.id,
        message: newMessage,
        channel: message.channel
      });
    } catch (err) {
      console.error('Socket editMessage error:', err);
    }
  });

  socket.on('typing', (data) => {
    socket.to(data.channel || 'general').emit('typing', data);
  });

  socket.on('stopTyping', (data) => {
    socket.to(data.channel || 'general').emit('stopTyping', data);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);

    // General chat cleanup
    if (onlineUsers.has(socket.id)) {
      onlineUsers.delete(socket.id);
      const uniqueUsers = Array.from(
        new Map(Array.from(onlineUsers.values()).map(u => [u.email, u])).values()
      );
      io.to('general').emit('online_users_update', uniqueUsers);
    }

    // Support chat cleanup
    const queueIndex = supportQueue.findIndex(u => u.socketId === socket.id);
    if (queueIndex > -1) {
      supportQueue.splice(queueIndex, 1);
      io.to('admins').emit('support_queue_update', supportQueue);
      console.log(`User ${socket.id} removed from support queue on disconnect.`);
    }

    // Stream cleanup
    if (socket.streamId) {
      activeStreams.delete(socket.streamId);
      delete broadcasters[socket.streamId];
      io.emit('live_streams_update', Array.from(activeStreams));
      socket.broadcast.emit('disconnectPeer', socket.id);
      // Clear viewers for this stream
      streamViewers.delete(socket.streamId);
    }

    // Viewer cleanup
    streamViewers.forEach((viewers, streamId) => {
      if (viewers.has(socket.id)) {
        viewers.delete(socket.id);
        broadcastViewerCount(streamId);
      }
    });

    // Cleanup plural sessions
    const sessionIndex = activeSupportSessions.findIndex(s => s.userSocketId === socket.id || s.adminSocketId === socket.id);
    if (sessionIndex !== -1) {
      const session = activeSupportSessions[sessionIndex];
      const endMessage = socket.id === session.userSocketId ? 'The user has disconnected.' : 'The admin has disconnected.';
      io.to(session.room).emit('support_session_ended', { message: endMessage });

      const uSocket = io.sockets.sockets.get(session.userSocketId);
      const aSocket = io.sockets.sockets.get(session.adminSocketId);
      if (uSocket) uSocket.leave(session.room);
      if (aSocket) aSocket.leave(session.room);
      activeSupportSessions.splice(sessionIndex, 1);
      console.log(`Support session in room ${session.room} ended due to disconnect.`);
    }
  });
});
app.set('io', io); // Make io accessible to the rest of the app if needed

// -----------------------------------------------------------------------------
// 10. SERVE FRONTEND & START SERVER
// -----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Serve static files from the 'dist' folder (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// 2. Serve uploads if you still use local storage (though you use Cloudinary)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. Serve the service worker file for PWA functionality
app.get('/sw.js', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'sw.js'));
});
// 3. SPA Routing: MUST be the very last route. 

app.get('*', async (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  const eventId = req.query.event;
  const announcementId = req.query.announcement;

  // Default Metadata
  let meta = {
    title: "MUTSDA - Seventh-day Adventist Church",
    description: "Welcome to our church community. Join us for worship and upcoming events.",
    image: "https://mutsda.onrender.com/default-og-image.jpg", // Change to your actual default banner
    url: `https://mutsda.onrender.com${req.originalUrl}`
  };

  try {
    // 1. If the link is for an Event
    if (eventId) {
      const event = await sequelize.models.Event.findByPk(eventId);
      if (event) {
        meta.title = event.title;
        meta.description = event.description ? event.description.substring(0, 160) : meta.description;
        meta.image = event.banner_image_url || meta.image;
      }
    }
    // 2. If the link is for an Announcement
    else if (announcementId) {
      const announcement = await sequelize.models.Announcement.findByPk(announcementId);
      if (announcement) {
        meta.title = `Update: ${announcement.title}`;
        meta.description = announcement.content ? announcement.content.substring(0, 160) : meta.description;
        // Use a specific announcement image or the church logo
        meta.image = "https://mutsda.onrender.com/announcement-share-banner.jpg";
      }
    }
  } catch (err) {
    console.error("SEO/OG Metadata Fetch Error:", err);
  }

  // Read the index.html and inject the tags into the <head>
  fs.readFile(indexPath, 'utf8', (err, htmlData) => {
    if (err) {
      return res.sendFile(indexPath); // Fallback if file read fails
    }

    // Escape user-sourced values before interpolating into HTML attributes
    const escapeHtml = (str) => String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const safeTitle = escapeHtml(meta.title);
    const safeDesc = escapeHtml(meta.description);
    const safeImage = escapeHtml(meta.image);
    const safeUrl = encodeURI(meta.url); // encode the URL, don't trust raw input

    const ogTags = `
      <title>${safeTitle}</title>
      <meta name="description" content="${safeDesc}" />
      <meta property="og:title" content="${safeTitle}" />
      <meta property="og:description" content="${safeDesc}" />
      <meta property="og:image" content="${safeImage}" />
      <meta property="og:url" content="${safeUrl}" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content="${safeImage}" />
    `;

    // Inject before the closing </head> tag
    const finalHtml = htmlData.replace('</head>', `${ogTags}</head>`);
    res.send(finalHtml);
  });
});
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));