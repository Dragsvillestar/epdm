// config/passport.js

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const Logger = require('../models/logger');
const Admin = require('../models/admin');

// === Logger login strategy ===
passport.use('logger-local', new LocalStrategy(async (username, password, done) => {
  try {
    const user = await Logger.findOne({ username });
    if (!user) return done(null, false, { message: 'Incorrect username.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return done(null, false, { message: 'Incorrect password.' });

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// === Admin login strategy ===
passport.use('admin-local', new LocalStrategy(async (username, password, done) => {
  try {
    const user = await Admin.findOne({ username });
    if (!user) return done(null, false, { message: 'Incorrect username.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return done(null, false, { message: 'Incorrect password.' });

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// === Serialize user ===
passport.serializeUser((user, done) => {
  // Tag the user type (helps with deserialization)
  const type = user instanceof Admin ? 'admin' : 'logger';
  done(null, { id: user.id, type });
});

// === Deserialize user ===
passport.deserializeUser(async ({ id, type }, done) => {
  try {
    let user = null;
    if (type === 'admin') {
      user = await Admin.findById(id);
    } else {
      user = await Logger.findById(id);
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
