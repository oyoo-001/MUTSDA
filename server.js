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
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

dotenv.config();

// -----------------------------------------------------------------------------
// 2. APP INITIALIZATION & MIDDLEWARE
// -----------------------------------------------------------------------------

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
    ];
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.ngrok-free.dev') || origin.endsWith('.ngrok-free.app') || origin.endsWith('.ngrok.io')) {
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
      return sequelize.sync({ alter: true });
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

const RSVP = sequelize.define('RSVP', {
  event_id: { type: DataTypes.INTEGER, allowNull: false },
  member_email: { type: DataTypes.STRING, allowNull: false },
  member_name: DataTypes.STRING,
  status: { type: DataTypes.ENUM('attending', 'not_attending', 'maybe'), defaultValue: 'attending' },
}, { timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });

// Define relationships for Chat
User.belongsToMany(ChatGroup, { through: 'ChatGroupMembers' });
ChatGroup.belongsToMany(User, { through: 'ChatGroupMembers' });

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
const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "465"),
    secure: true, // true for port 465 (SSL)
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const message = {
    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  try {
    const info = await transporter.sendMail(message);
    console.log('Message sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Email Error:', error);
    throw error;
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
      // Basic filtering from query params
      const where = { ...req.query };
      // TODO: Add sorting capabilities if needed
      const items = await model.findAll({ where, order: [['created_date', 'DESC']] });
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
        // Exclude password from being updated this way
        const { password, ...updateData } = req.body;
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
      console.log(`User ${email} created with temporary password: ${tempPassword}`);
      console.log('Advise user to log in and change their password, or use the "Forgot Password" feature.');
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

      // 1. Generate a 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

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
      const sermons = await Sermon.findAll({
        where: { published: true },
        order: [['sermon_date', 'DESC']]
      });
      res.json(sermons);
    } catch (err) {
      console.error('Error in Sermon getAll:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  },
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
  create: async (req, res) => {
    const { transaction_reference, amount } = req.body;

    if (!transaction_reference) {
      return res.status(400).json({ message: "Transaction reference is required." });
    }

    try {
      // 1. Verify transaction with Paystack
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
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error("Failed to parse Paystack response"));
            }
          });
        });

        apiReq.on('error', error => { reject(error); });
        apiReq.end();
      });

      // 2. Check if verification was successful and data is valid
      if (!paystackResponse.status || paystackResponse.data.status !== 'success') {
        console.error("Paystack verification failed:", paystackResponse);
        return res.status(400).json({ message: "Transaction verification failed." });
      }

      // 3. Security Check: Verify amount matches
      const paidAmount = paystackResponse.data.amount; // Amount in kobo/cents
      const expectedAmount = Math.round(parseFloat(amount) * 100); // Round to avoid floating point errors
      if (paidAmount < expectedAmount) {
        console.error(`Amount mismatch. Paid: ${paidAmount}, Expected: ${expectedAmount}`);
        return res.status(400).json({ message: `Amount mismatch. Paid: ${paidAmount}, Expected: ${expectedAmount}` });
      }

      // 4. If all checks pass, create the donation record
      const donationPayload = {
        ...req.body,
        status: 'success',
        amount: amount // Ensure amount is explicitly set
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
  webhook: async (req, res) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    // Use rawBody for signature verification to avoid JSON parsing issues
    const payload = req.rawBody || JSON.stringify(req.body);
    const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');

    if (hash === req.headers['x-paystack-signature']) {
      const event = req.body;
      if (event.event === 'charge.success') {
        const { reference, amount, metadata, customer, channel } = event.data;
        
        try {
          const [donation, created] = await Donation.findOrCreate({
            where: { transaction_reference: reference },
            defaults: {
              donor_name: metadata?.donor_name || 'Anonymous',
              donor_email: customer.email,
              donation_type: metadata?.donation_type || 'offering',
              custom_fund_name: metadata?.custom_fund_name,
              amount: amount / 100,
              payment_method: channel,
              status: 'success'
            }
          });

          if (!created && donation.status !== 'success') {
            await donation.update({ status: 'success' });
          }
          console.log(`Webhook: Transaction ${reference} verified successfully.`);
          if (req.app.get('io')) {
            req.app.get('io').emit('donations_updated');
          }
        } catch (error) {
          console.error('Webhook DB Error:', error);
        }
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(400);
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
};
const rsvpController = createController(RSVP, 'rsvps');
const chatMessageController = createController(ChatMessage, 'chat');

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
authRouter.get('/me', protect, authController.getMe);
authRouter.post('/forgot-password', authController.forgotPassword);
authRouter.post('/verify-otp', authController.verifyOtp);
authRouter.post('/reset-password', authController.resetPassword);

const sermonRouter = express.Router();
sermonRouter.get('/', sermonController.getAll); // Public
sermonRouter.get('/:id', sermonController.getById); // Public
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
donationRouter.post('/webhook', donationController.webhook);
donationRouter.get('/', protect, admin, donationController.getAll); // Admin only
donationRouter.post('/', donationController.create); // Public

const mediaItemRouter = express.Router();
mediaItemRouter.get('/', mediaItemController.getAll); // Public
mediaItemRouter.post('/', protect, admin, mediaItemController.create);
mediaItemRouter.delete('/:id', protect, admin, mediaItemController.delete);

const contactMessageRouter = express.Router();
contactMessageRouter.get('/', protect, admin, contactMessageController.getAll); // Admin only
contactMessageRouter.post('/', contactMessageController.create); // Public
contactMessageRouter.put('/:id/read', protect, admin, contactMessageController.markAsRead);

const userRouter = express.Router(); // For admin to manage users
userRouter.get('/', protect, admin, userController.getAll);
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

const coreRouter = express.Router();
coreRouter.post('/send-email', async (req, res) => {
    const { to, subject, body } = req.body;
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
app.use('/api/core', protect, admin, coreRouter);


// -----------------------------------------------------------------------------
// 9. SOCKET.IO for Live Chat
// -----------------------------------------------------------------------------

const supportQueue = []; // Array of { id, name, email, socketId }
let activeSupportSession = null; // { adminSocketId, userSocketId, room, user }
const onlineUsers = new Map(); // Map<socket.id, userObject>
let currentTickerState = { message: "", textColor: "#1a2744", backgroundColor: "#c8a951", speed: 95 }; // Store the active news ticker message and color
let currentTextOverlayState = { text: "", fontSize: 32, isVisible: false, isFullScreen: false, backgroundImage: "", backgroundColor: "#1a2744", backgroundOpacity: 0.8 }; // Store text overlay state
const activeStreams = new Set();
const broadcasters = {}; // streamId -> socketId
const streamViewers = new Map(); // streamId -> Map<socketId, lastHeartbeatTimestamp>

const io = new Server(server, {
  cors: corsOptions,
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

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
    if (activeSupportSession) {
      socket.emit('admin_busy');
    }
    // Avoid adding duplicates
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

    if (activeSupportSession) {
      socket.emit('error', { message: 'Another support session is already active.' });
      return;
    }

    const userIndex = supportQueue.findIndex(u => u.socketId === targetUser.socketId);
    const userToChat = supportQueue[userIndex];

    if (userToChat) {
      supportQueue.splice(userIndex, 1);
      
      const room = `support_${userToChat.id}`;
      activeSupportSession = {
        adminSocketId: socket.id,
        userSocketId: userToChat.socketId,
        room: room,
        user: userToChat
      };

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
    if (activeSupportSession && activeSupportSession.adminSocketId === socket.id) {
      const { room, userSocketId } = activeSupportSession;
      console.log(`Admin ${socket.id} ended support session in room ${room}.`);
      
      io.to(room).emit('support_session_ended', { message: 'The admin has ended the chat session.' });
      
      const userSocket = io.sockets.sockets.get(userSocketId);
      if(userSocket) userSocket.leave(room);
      socket.leave(room);

      activeSupportSession = null;
    }
  });

  socket.on('i_am_online', (user) => {
    if (user) {
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
        const message = { ...data, created_date: new Date() };
        io.to(data.channel).emit('newMessage', message);
        await ChatMessage.create(data); // Save support message to DB
      } else {
        // General community chat
        const { replyTo, ...messageData } = data;
        if (replyTo && replyTo.id) {
            messageData.reply_to_message_id = replyTo.id;
            messageData.reply_to_sender_name = replyTo.sender_name;
            
            let snippet = replyTo.message;
            if (snippet && snippet.length > 120) {
                snippet = snippet.substring(0, 117) + '...';
            }
            // Use filename for media snippet, fallback to 'Attachment'
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
      const { messageId, userEmail } = data;
      if (!messageId || !userEmail) {
        socket.emit('deleteError', { message: 'Invalid request.' });
        return;
      }

      const user = await User.findOne({ where: { email: userEmail } });
      if (!user) {
        socket.emit('deleteError', { message: 'User not found.' });
        return;
      }

      const message = await ChatMessage.findByPk(messageId);
      if (!message) {
        return; // Message already deleted, do nothing.
      }

      const canDelete = user.role === 'admin' || user.email === message.sender_email;

      if (canDelete) {
        await message.destroy();
        io.to(message.channel).emit('messageDeleted', { messageId: message.id, channel: message.channel });
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
      const { messageId, newMessage, userEmail } = data;
      if (!messageId || !newMessage || !userEmail) return;

      const message = await ChatMessage.findByPk(messageId);
      if (!message) return;

      // Check if user is the sender
      if (message.sender_email !== userEmail) {
        socket.emit('error', { message: 'You can only edit your own messages.' });
        return;
      }

      await message.update({ message: newMessage });
      io.to(message.channel).emit('messageUpdated', { id: message.id, message: newMessage, channel: message.channel });
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

    if (activeSupportSession) {
      const { room, userSocketId, adminSocketId } = activeSupportSession;
      if (socket.id === userSocketId || socket.id === adminSocketId) {
        const endMessage = socket.id === userSocketId ? 'The user has disconnected.' : 'The admin has disconnected.';
        io.to(room).emit('support_session_ended', { message: endMessage });
        
        const userSocket = io.sockets.sockets.get(userSocketId);
        const adminSocket = io.sockets.sockets.get(adminSocketId);
        if(userSocket) userSocket.leave(room);
        if(adminSocket) adminSocket.leave(room);
        activeSupportSession = null;
        console.log(`Support session in room ${room} ended due to disconnect.`);
      }
    }
  });
});
app.set('io', io); // Make io accessible to the rest of the app if needed

// -----------------------------------------------------------------------------
// 10. SERVE FRONTEND & START SERVER
// -----------------------------------------------------------------------------
const __dirname = path.resolve();

// 1. Serve static files from the 'dist' folder (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// 2. Serve uploads if you still use local storage (though you use Cloudinary)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. SPA Routing: MUST be the very last route. 
// This handles the "MIME type" error by ensuring 404s on assets 
// don't accidentally return index.html while the browser expects JS.
app.get('*', (req, res) => {
  const file = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(file);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));