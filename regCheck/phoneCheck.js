const express = require('express');
const Logger = require('../models/logger');  // Importing Logger model
const router = express.Router();

router.get("/", async (req, res) => { 
    const { phone } = req.query; 
  
    
    try {
      const existingUser = await Logger.findOne({ phone });
  
      if (existingUser) {
        return res.json({ exists: true, message: "Phone number already registered" });
      }
  
      return res.json({ exists: false, message: "" });
  
    } catch (error) {
      console.error('Error checking phone number:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  module.exports = router;