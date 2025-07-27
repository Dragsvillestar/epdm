const express = require('express');
const router = express.Router();
const passport = require('../config/passportConfig');;
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');
const { sendVerificationEmail, transporter } = require('../controllers/emailverification'); 
const Admin = require('../models/admin'); 
const GlobalStats = require('../models/globalStat');

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/index3.html'));
});

router.post('/login', (req, res, next) => {
  passport.authenticate('admin-local', (err, admin, info) => {
    if (err) {
      return next(err);
    }

    if (!admin) {
      return res.json({ error: info ? info.message : 'Username or password incorrect' });
    }

    req.login(admin, (err) => {
      if (err) {
        return next(err);
      }
      return res.json({ success: 'Login Successful' });
    });
  })(req, res, next);
});


router.post("/register", async (req, res) => {
  
  try {
    const { newAdminUsername, newAdminPassword, newAdminEmail, currentAdminUsername, currentAdminPassword } = req.body;

    // Check if current admin exists
    const currentAdmin = await Admin.findOne({ username: currentAdminUsername });
    if (!currentAdmin) {
      return res.json({ error: "Current admin not found." });
    }

    // Verify current admin's password
    const isMatch = await bcrypt.compare(currentAdminPassword, currentAdmin.password);
    if (!isMatch) {
      return res.json({ error: "Invalid current admin credentials." });
    }

    // Check if a new admin with the given username already exists
    const existingNewAdmin = await Admin.findOne({ username: newAdminUsername });
    if (existingNewAdmin) {
      return res.json({ error: "New admin username already exists." });
    }

    const existingNewAdminEmail = await Admin.findOne({ email: newAdminEmail });
    if (existingNewAdminEmail) {
      return res.json({ error: "New admin email already exists." });
    }

    // Hash the new admin's password
    const hashedPassword = await bcrypt.hash(newAdminPassword, 10);

    // Create and save the new admin document
    const newAdmin = new Admin({
      username: newAdminUsername,
      password: hashedPassword,
      email: newAdminEmail
    });

    await newAdmin.save();

    res.json({ success: true, message: "New admin registered successfully." });
  } catch (error) {
    console.error("Error during admin registration:", error);
    res.json({ error: "Server error during registration." });
  }
});


router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = await Admin.findOne({ email });

  if (!user) {
      return res.status(400).json({ message: "Email not found" });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetToken = resetToken;
  user.resetTokenExpiry = Date.now() + 3600000; // 1-hour expiration
  await user.save();

  const resetLink = `http://localhost:5173/admin/reset_password/${resetToken}`;

  try {
      const info = await transporter.sendMail({
          from: "EnergyProjectsData <info@energyprojectsdata.com>",
          to: email,
          subject: "Admin Password Reset",
          text: `You requested a password reset. Click the link below to reset your password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.`,
          html: `
            <p>You requested a password reset. Click the button below to reset your password:</p>
            <p><a href="${resetLink}" style="background-color:#007bff;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Reset Password</a></p>
            <p>If you did not request this, please ignore this email.</p>
          `,
      });    

      res.json({ message: "Reset email sent" });
      console.log("✅ Email sent: " + info.response);
  } catch (error) {
      res.json({ message: "Error sending email" });
      console.error("Error sending email:", error);
  }
});

router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await Admin.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.json({ success: false, message: "Invalid or expired token" });
    }
     console.log("admin user:", user)
    user.password = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;

    await user.save();

    res.json({success:true, message: "Password reset successful" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.json({ success: false, message: "An error occurred while resetting the password" });
  }
});

router.post('/logs', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.json({ error: "Unauthorized: Login required" });
  }

  try {
    const { startDate, endDate } = req.body;
    const stats = await GlobalStats.findOne();

    if (!stats || !stats.loggedInUsers) {
      return res.json({ error: "No logs available." });
    }

    const today = new Date().toISOString().slice(0, 10);
    let filteredLogs;

    if (!startDate) {
      filteredLogs = stats.loggedInUsers.filter(log => log.date === today);
    } else {
      const from = startDate;
      const to = endDate || from;

      filteredLogs = stats.loggedInUsers.filter(log =>
        log.date >= from && log.date <= to
      );
    }

    res.json({ logs: filteredLogs });
  } catch (err) {
    console.error("Error fetching logs:", err);
    res.status(500).json({ error: "Server error while fetching logs." });
  }
});

module.exports = router;
