require('dotenv').config();

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const favicon = require('serve-favicon');
const hbs = require('hbs');
const mongoose = require('mongoose');
const logger = require('morgan');
const path = require('path');
const app_name = require('./package.json').name;
const debug = require('debug')(`${app_name}:${path.basename(__filename).split('.')[0]}`);
const session = require('express-session');
const bcrypt = require('bcrypt');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const SlackStrategy = require('passport-slack').Strategy;
const GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;
const flash = require('connect-flash');
const authRoutes = require('./routes/auth-routes');
const User = require('./models/user.js');


// Mongoose configuration

// mongoose
//   .connect('mongodb://localhost/auth-passport', { useNewUrlParser: true })
//   .then((x) => {
//     console.log(`Connected to Mongo! Database name: "${x.connections[0].name}"`);
//   })
//   .catch((err) => {
//     console.error('Error connecting to mongo', err);
//   });


mongoose.Promise = Promise;
mongoose
  .connect('mongodb://localhost/auth-passport', { useMongoClient: true })
  .then(() => {
    console.log('Connected to Mongo!');
  }).catch((err) => {
    console.error('Error connecting to mongo', err);
  });


const app = express();

// Middleware Setup
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Express View engine setup

app.use(require('node-sass-middleware')({
  src: path.join(__dirname, 'public'),
  dest: path.join(__dirname, 'public'),
  sourceMap: true,
}));


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));


// default value for title local
app.locals.title = 'AuthPassport - Simple Aplication with Passport';

// Midlleware

app.use(session({
  secret: 'our-passport-local-strategy-app',
  resave: true,
  saveUninitialized: true,
}));

passport.serializeUser((user, cb) => {
  cb(null, user._id);
});

passport.deserializeUser((id, cb) => {
  User.findById(id, (err, user) => {
    if (err) { return cb(err); }
    cb(null, user);
  });
});

app.use(flash());
passport.use(new LocalStrategy({
  passReqToCallback: true,
}, (req, username, password, next) => {
  User.findOne({ username }, (err, user) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return next(null, false, { message: 'Incorrect username' });
    }
    if (!bcrypt.compareSync(password, user.password)) {
      return next(null, false, { message: 'Incorrect password' });
    }

    return next(null, user);
  });
}));

passport.use(new SlackStrategy({
  clientID: '2432150752.476673281264',
  clientSecret: 'f572525af16252171bf113b88c9d50ba',
}, (accessToken, refreshToken, profile, done) => {
  User.findOne({ slackID: profile.id })
    .then((user) => {
      if (user) {
        return done(null, user);
      }

      const newUser = new User({
        slackID: profile.id,
      });

      newUser.save()
        .then(() => {
          done(null, newUser);
        });
    })
    .catch((error) => {
      done(error);
    });
}));

passport.use(new GoogleStrategy({
  clientID: '1000479672220-98ua48rhpec10l3bo6fgt3ngp4753q5g.apps.googleusercontent.com',
  clientSecret: 'T2AllpBzRbh3pQUexEzj0SmW',
  callbackURL: '/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
  User.findOne({ googleID: profile.id })
    .then((user) => {
      if (user) {
        return done(null, user);
      }
      const newUser = new User({
        googleID: profile.id,
      });
      newUser.save()
        .then(() => {
          done(null, newUser);
        });
    })
    .catch((error) => {
      done(error);
    });
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes

app.use('/', authRoutes);

// const index = require('./routes/index');

// app.use('/', index);

module.exports = app;
