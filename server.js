require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require("crypto");
const Logger = require('./models/logger');
const { sendVerificationEmail, transporter } = require('./controllers/emailverification');
const emailSendRoute = require('./controllers/emailSender');
const passport = require('./config/passportConfig');
const sessionMiddleware = require('./config/sessionConfig');
const phoneVerificationRoute = require('./regCheck/phoneCheck');
const usernameVerificationRoute = require('./regCheck/usernameCheck');
const emailVerificationRoute = require('./regCheck/emailCheck');
const registerRoute = require('./regCheck/register');
const verifyEmailRoute = require('./verifyAndResends/verify-email');
const resendEmailVerificationRoute = require('./verifyAndResends/resendEmailVerification');
const newProjectRoute = require("./project/newProject");
const adminRoute = require("./project/adminlogin");
const paymentRoute = require("./controllers/payment");
const currentProjectsRoute = require("./project/currentProjects");
const http = require("http");
const { Server } = require("socket.io");
const GlobalStats = require("./models/globalStat");
const cors = require('cors');
const { CronJob } = require('cron');
const sendExpiryReminders = require('./controllers/sendExpiryReminder');

const app = express();

const server = http.createServer(app);
const io = require("socket.io")(server, {
  path: '/api/socket.io',
  cors: {
    origin: ["http://localhost:5173", 'https://www.energyprojectsdata.com/', 'https://energyprojectsdata.com'],
    methods: ["GET", "POST"],
    credentials: true
  }
});
// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true // optional, if you're using cookies or auth headers
}));
app.set('view engine', 'pug');
app.set('views', './views/pug');
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use("/api/phone", phoneVerificationRoute);
app.use("/api/username", usernameVerificationRoute);
app.use("/api/email", emailVerificationRoute);
app.use('/api/register', registerRoute);
app.use("/api/verify-email", verifyEmailRoute);
app.use("/api/resend-email-verification", resendEmailVerificationRoute);
app.use("/api/new-project", newProjectRoute);
app.use("/api/admin", adminRoute);
app.use("/api/initiate-payment", paymentRoute);
app.use("/api/projects", currentProjectsRoute)
app.use("/api/emailSend", emailSendRoute)

// app.use((req, res, next) => {
//   console.log('Session Data:', req.session);
//   console.log("Current Time:", new Date());
//   console.log("Session Expiration:", req.session.cookie.expires);

//   next(); // Proceed to the next middleware/route handler
// });


app.post('/api/login', (req, res, next) => {
  passport.authenticate('logger-local', (err, user) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return res.json({ error: 'Username or password incorrect' });
    }

    if (!user.emailVerified) {
      return res.json({ message: "Please verify your email first." });
    }

    req.login(user, (err) => {
      if (err) return next(err);
      return res.json({success:'true', redirectTo: "/home" });
    });
  })(req, res, next);
});

app.get("/api/profile", (req, res) => {
  if (req.isAuthenticated()) {
    const {
      username,
      email,
      phone,
      address,
      position,
      nature,
      subscriptionExpiry
    } = req.user;

    res.json({
      Username: username,
      Email: email,
      Phone: phone,
      Address: address,
      Position: position,
      "Nature of Business": nature,
      "Subscription Expiry Date": subscriptionExpiry
    });

  } else {
    res.status(401).json({ error: true, message: "User not logged in" });
  }
});


app.patch("/api/profile/update", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const updateData = req.body;

      const updatedUser = await Logger.findOneAndUpdate(
        { _id: req.user._id },
        { $set: updateData },
        { new: true }
      );

      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
  } else {
    res.status(401).json({ message: "User not logged in" });
  }
});


app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = await Logger.findOne({ email });

  if (!user) {
    return res.json({success:false, message: "Email not found" });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetToken = resetToken;
  user.resetTokenExpiry = Date.now() + 3600000; // 1-hour expiration
  await user.save();

  const resetLink = `http://localhost:5173/reset_password/${resetToken}`;

  try {
    const info = await transporter.sendMail({
      from: "EnergyProjectsData <info@energyprojectsdata.com>",
      to: email,
      subject: "Password Reset",
      text: `You requested a password reset. Click the link below to reset your password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.`,
      html: `
            <p>You requested a password reset. Click the button below to reset your password:</p>
            <p><a href="${resetLink}" style="background-color:#007bff;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Reset Password</a></p>
            <p>If you did not request this, please ignore this email.</p>
          `,
    });

    res.json({success:true, message: "Reset email sent" });
    console.log("✅ Email sent: " + info.response);
  } catch (error) {
    res.json({ message: "Error sending email" });
    console.error("Error sending email:", error);
  }
});

// app.get("/reset-password/:token", async (req, res) => {
//   const { token } = req.params;
//   const user = await Logger.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });

//   if (!user) {
//     return res.status(400).send("Invalid or expired token");
//   }

//   res.render("resetPassword", { token });
// });

app.post("/api/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    // Find user with the reset token that is not expired
    let user = await Logger.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.json({ success: false, message: "Invalid or expired token" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user with the new password and clear reset token
    user = await Logger.findOneAndUpdate(
      {
        resetToken: token,
        resetTokenExpiry: { $gt: Date.now() }
      },
      {
        password: hashedPassword,
        resetToken: undefined,
        resetTokenExpiry: undefined
      },
      { new: true } // Return the updated document
    );

    res.json({success:true, message: "Password reset successful" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.json({ success: false, message: "An error occurred while resetting the password" });
  }
});

const job = new CronJob(
  '0 9 * * *', 
  () => {
    console.log("Running reminder job at:", new Date());
    sendExpiryReminders();
  },
  null,
  true,
  'Africa/Lagos' 
);

job.start();

async function ensureGlobalStats() {
  let stats = await GlobalStats.findOne();
  if (!stats) {
    stats = new GlobalStats();
    await stats.save();
  }
  return stats;
}

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, () => {
    passport.initialize()(socket.request, {}, () => {
      passport.session()(socket.request, {}, next);
    });
  });
});

io.on("connection", async (socket) => {
  console.log("A user connected");

  let stats = await ensureGlobalStats();
  const session = socket.request.session;
  const currentLogger = socket.request.user;
  const today = new Date().toISOString().slice(0, 10);

  if (currentLogger) {
    let todayLog = stats.loggedInUsers.find(log => log.date === today);

    
    if (!todayLog) {
      stats.loggedInUsers.push({ date: today, users: [] });
      todayLog = stats.loggedInUsers[stats.loggedInUsers.length - 1];      
    }
    const alreadyLogged = todayLog.users.some(u => u.userId.toString() === currentLogger._id.toString());
    if (!alreadyLogged) {
      todayLog.users.push({
        userId: currentLogger._id,
        username: currentLogger.username,
        email: currentLogger.email,
        phone: currentLogger.phone,
        company: currentLogger.company,
        address: currentLogger.address,
        position: currentLogger.position,
        nature: currentLogger.nature,
        subscribed: currentLogger.subscribed,
        subscriptionExpiry: currentLogger.subscriptionExpiry,
        subscribedProjects: currentLogger.subscribedProjects
      });
    }
    await stats.save();
  } else {
    console.log("Unauthenticated socket connection");
  }
   

  // console.log("Saving stats.loggedInUsers:", JSON.stringify(stats.loggedInUsers, null, 2));


  if (session.lastVisitDate !== today) {
    session.lastVisitDate = today;
    session.save(); // Save to Mongo

    stats.siteVisits += 1;

    if (!stats.dailyVisits || stats.dailyVisits.date !== today) {
      stats.dailyVisits = { count: 1, date: today };
    } else {
      stats.dailyVisits.count += 1;
    }

    await stats.save();
  }

  io.emit("siteTrafficUpdate", stats.siteVisits);
  io.emit("dailyTrafficUpdate", stats.dailyVisits.count);

  // Always send view count
  socket.emit("viewCountUpdate", stats.totalViews);

  // Track project views (you can apply the same idea here if needed)
  socket.on("projectViewed", async () => {
    stats.totalViews += 1;
    await stats.save();

    io.emit("viewCountUpdate", stats.totalViews);
  });
});

app.get('/api/session_destroy', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).send("Logout failed");
    }

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).send("Session destruction failed");
      }
      console.log('session destroyed')
      return res.json({ success: true, message:'session destroyed' });
    });
  });
});

app.get('/api/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).send("Logout failed");
    }

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).send("Session destruction failed");
      }
      console.log('session destroyed')
      return res.json({ success: true, redirectTo: "/" });
    });
  });
});


// Start Server
const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
