const session = require('express-session');
const MongoStore = require('connect-mongo');

const sessionStore = MongoStore.create({ 
    mongoUrl: process.env.MONGO_URI, 
    collectionName: 'sessions' 
  });
  
  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, 
    store: sessionStore,
    key: 'express.sid',
    cookie: { secure: false, httpOnly: true, maxAge: 180000 },
    rolling:true
  });

  module.exports = sessionMiddleware;