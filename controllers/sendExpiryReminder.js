const nodemailer = require("nodemailer");
const Logger = require('../models/logger');

const transporter = nodemailer.createTransport({
  host: "smtp.zeptomail.com",
  port: 587,
  auth: {
    user: "emailapikey",
    pass: process.env.ZOHOEMAILPASS,
  }
});

const { format } = require('date-fns');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function sendExpiryReminders() {
    try {
        const now = new Date();
        const next24h = new Date(now.getTime() + ONE_DAY_MS);

        // Find users whose subscriptionExpiry is within next 24 hours
        const users = await Logger.find({
            subscriptionExpiry: {
                $gte: now,
                $lte: next24h,
            },
            email: { $exists: true, $ne: null },
        });

        if (users.length === 0) {
            console.log('No users with expiring subscriptions today.');
            return;
        }

        for (const user of users) {
            const expiryDate = format(new Date(user.subscriptionExpiry), 'PPPpp');

            const mailOptions = {
                from: 'EnergyProjectsData <info@energyprojectsdata.com>',
                to: user.email,
                subject: '⏰ Your subscription is expiring soon',
                html: `<p>Hello,</p>
                       <p>Your subscription will expire on <strong>${expiryDate}</strong>.</p>
                       <p>Please renew your subscription to avoid disruption.</p>
                       <p>Thank you,<br>EnergyProjectsData</p>`,
            };

            await transporter.sendMail(mailOptions);
            console.log(`Reminder sent to ${user.email}`);
        }
    } catch (error) {
        console.error('Error sending subscription reminders:', error);
    }
}


module.exports = sendExpiryReminders