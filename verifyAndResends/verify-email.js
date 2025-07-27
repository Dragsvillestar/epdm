const express = require('express');
const Logger = require('../models/logger'); 
const router = express.Router();

router.post("/", async (req, res) => {
    const { token } = req.body;

    if (!token) {
      return res.json({ success: 'false', message: "Verification token is required." });
    }
  
    try {
      const user = await Logger.findOne({ 
        verificationToken: token, 
        verificationTokenExpiry: { $gt: Date.now() } 
      });
  
      if (!user) {
        return res.json({success:false, message: "Invalid or expired verification token." });
      }

      if (user.emailVerified === true) {
        return res.json({ success: true, message: "Email already verified." });
      }
  
      user.emailVerified = true;
      user.verificationToken = null;
      user.verificationTokenExpiry = null;
      await user.save();
      console.log("ver user found")
      res.json({ success: true, message: 'Email verified' })
    } catch (error) {
      console.error("Error verifying email:", error);
      res.status(500).json({ message: "An error occurred while verifying the email." });
    }
  });
  
  module.exports = router;