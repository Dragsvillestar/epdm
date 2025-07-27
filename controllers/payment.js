const express = require('express');
const axios = require('axios');
const Logger = require('../models/logger');
const moment = require("moment-timezone");
const path = require('path');
const Flutterwave = require('flutterwave-node-v3');
const flw = new Flutterwave(process.env.FW_PUBLIC, process.env.FW_SECRET);

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const amount = 100; // Fixed amount
        const email = req.user.email;
        const name = req.user.username; // Assuming username is stored in req.user

        console.log("email:", email);
        const paymentData = {
            tx_ref: `${name}_${Date.now()}`, 
            amount,
            currency: "NGN",
            redirect_url: "http://localhost:3001/api/initiate-payment/callback",
            payment_options: "card, banktransfer", // Payment methods supported
            customer: { email, name }
        };

        const response = await axios.post('https://api.flutterwave.com/v3/payments', paymentData, {
            headers: { 'Authorization': `Bearer ${process.env.FW_SECRET}`, 'Content-Type': 'application/json' }
        });

        res.json({ paymentLink: response.data.data.link }); // Send payment link to frontend
    } catch (error) {
        console.error("Payment Error:", error.response?.data || error.message);
        res.status(500).json({ error: 'Payment failed' });
    }
});

router.post('/flutterwave-webhook', async (req, res) => {
    const payload = req.body;
    const txRef = payload.txRef;
    const username = txRef.split('_')[0]; 

    console.log("Webhook received:", payload);

    // Verify Flutterwave Signature
    const secretHash = process.env.FLW_SECRET_HASH;
    const flutterwaveSignature = req.headers["verif-hash"];

    if (!flutterwaveSignature || flutterwaveSignature !== secretHash) {
        return res.status(403).json({ error: "Invalid signature" });
    }

    // Process Payment Success
    if (payload.status === "successful") {
        const email = payload.customer.email;
        // const name = payload.customer.name || "Unknown User"; 
        // const amount = payload.amount;  
        // const transactionId = payload.transaction_id || payload.tx_ref; 

        try {
            const user = await Logger.findOne({ username: username });

            if (user) {
                user.subscribed = true;
                const timezone = "Africa/Lagos"; // Change this to your timezone

            if (user.subscriptionExpiry && user.subscriptionExpiry > Date.now()) {
                // Extend existing subscription
                user.subscriptionExpiry = moment(user.subscriptionExpiry)
                    .tz(timezone)
                    .add(30, "days")
                    .toDate();
            } else {
                // Start new subscription if expired or null
                user.subscriptionExpiry = moment().tz(timezone).add(30, "days").toDate();
            }
                await user.save();

                console.log(`✅ Subscription activated for ${user.username}`);

                // Manually update session if the user is logged in
                if (req.user && req.user.email === email) {
                    req.user.subscribed = true;
                    req.user.subscriptionExpiry = user.subscriptionExpiry;
                }
            } else {
                console.error("❌ User not found for email:", email);
            }
        } catch (error) {
            console.error("❌ Error updating user subscription:", error.message);
        }
    } else {
        console.log("❌ Payment was not successful:", payload.status);
    }

    res.sendStatus(200);
});

// Payment success route
router.get("/payment-success", (req, res) => {
    console.log("✅ Payment success page hit!");
    res.sendFile(path.join(__dirname, '..', 'views', 'paymentSuccess.html'));
});

router.get("/payment-failed", (req, res) => {
    console.log("❌ Payment failed page hit!");
    res.sendFile(path.join(__dirname, '..', 'views', 'paymentFailed.html'));
});

router.get('/callback', async (req, res) => {
    const transactionId = req.query.transaction_id;
    console.log(transactionId);

    try {
        const response = await flw.Transaction.verify({ id: transactionId });
        console.log(response);

        if (
            response.data.status === "successful" &&
            response.data.currency === "NGN"
        ) {
            res.redirect(`http://localhost:5173/payment_info?success=true`);
        } else {
            res.redirect(`http://localhost:5173/payment_info?success=false`);
        }
    } catch (err) {
        console.error(err);
        res.send("An error occurred during verification.");
    }
});

module.exports = router;
