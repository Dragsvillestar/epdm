const express = require('express');
const router = express.Router();
const Logger = require('../models/logger');
const Project = require('../models/project');
const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
  host: "smtp.zeptomail.com",
  port: 587,
  auth: {
    user: "emailapikey",
    pass: process.env.ZOHOEMAILPASS,
  }
});

function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}


router.post('/', async (req, res) => {
    if (req.isAuthenticated()) {
        const { type, subject, message, projectId } = req.body;

        if (!type || !subject || !message) {
            return res.json({ error: 'Missing required fields' });
        }

        try {
            let recipientEmails = [];

            if (type === 'all') {
                const users = await Logger.find({}, 'email');
                recipientEmails = users.map(u => u.email).filter(Boolean);
            } else if (type === 'specific') {
                if (!projectId) {
                    return res.json({ error: 'Project ID required for specific type' });
                }

                const project = await Project.findOne({ projectId });
                if (!project) {
                    return res.json({ error: 'Project not found' });
                }

                recipientEmails = project.subscribersEmails || [];

                if (!recipientEmails.length) {
                    return res.json({ error: 'No subscribers found for this project' });
                }
            } else {
                return res.json({ error: 'Invalid type: must be "all" or "specific"' });
            }

            console.log("recipients:", recipientEmails);
            const chunks = chunkArray(recipientEmails, 50);
            for (const chunk of chunks) {
                const batch = {
                    from: 'EnergyProjectsData <info@energyprojectsdata.com>',
                    to: 'info@energyprojectsdata.com',
                    bcc: chunk,
                    subject,
                    html: `<p>${message}</p>`,
                };
                await transporter.sendMail(batch);
            }

            return res.status(200).json({ success: true, message: 'Emails sent successfully' });

        } catch (err) {
            console.error('Error sending email:', err);
            return res.json({ error: 'Internal server error' });
        }
    } else {
    res.json({ success: false, error: "User not logged in" });
  }
});

module.exports = router;
