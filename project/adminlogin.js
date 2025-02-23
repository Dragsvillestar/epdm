const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcrypt');
const path = require('path');
const Admin = require('../models/admin'); 

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/index3.html'));
});

router.post('/login', (req, res, next) => {
  passport.authenticate('admin-local', (err, admin, info) => {
    if (err) {
      return next(err);
    }
    if (!admin) {
      return res.status(401).json({ error: info ? info.message : 'Username or password incorrect' });
    }
    console.log("Login Successful");
      return res.json({ success: 'Login Successful' });
  })(req, res, next);
});

router.post("/register", async (req, res) => {
  try {
    const { newAdminUsername, newAdminPassword, currentAdminUsername, currentAdminPassword } = req.body;

    // Check if current admin exists
    const currentAdmin = await Admin.findOne({ username: currentAdminUsername });
    if (!currentAdmin) {
      return res.status(401).json({ error: "Current admin not found." });
    }

    // Verify current admin's password
    const isMatch = await bcrypt.compare(currentAdminPassword, currentAdmin.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid current admin credentials." });
    }

    // Check if a new admin with the given username already exists
    const existingNewAdmin = await Admin.findOne({ username: newAdminUsername });
    if (existingNewAdmin) {
      return res.status(400).json({ error: "New admin username already exists." });
    }

    // Hash the new admin's password
    const hashedPassword = await bcrypt.hash(newAdminPassword, 10);

    // Create and save the new admin document
    const newAdmin = new Admin({
      username: newAdminUsername,
      password: hashedPassword
    });

    await newAdmin.save();

    res.status(201).json({ success: true, message: "New admin registered successfully." });
  } catch (error) {
    console.error("Error during admin registration:", error);
    res.status(500).json({ error: "Server error during registration." });
  }
});
  
module.exports = router;
