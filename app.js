var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var passport = require('passport');
const dotenv = require('dotenv').config({ path: './.env.' + process.env.ENV });

var app = express();

// VIEW ENGINE SETUP
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

app.use(passport.initialize());
app.use(passport.session());

var mongoose = require("mongoose");

// INITIATING AND ASSIGNING ROUTES
app.use('/', require('./routes/index'));
app.use('/authentication', require('./routes/authentication'));
app.use('/companies', require('./routes/companies'));
app.use('/users', require('./routes/users'));
app.use('/meetings', require('./routes/meetings'));
app.use('/ideations', require('./routes/ideations'));
app.use('/projects', require('./routes/projects'));
app.use('/tasks', require('./routes/tasks'));
app.use('*', function(req, res) {
    res.sendStatus(404);
});

// CATCH 404 AND FORWARD TO ERROR HANDLER
app.use(function(req, res, next) {
    next(createError(404));
});

// INITIATE THE DATABASE AND ESTABLISH CONNECTION
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);

//Set up default mongoose connection
mongoose.connect(process.env.DB_URL, { useNewUrlParser: true });
//Get the default connection
var db = mongoose.connection;

require('./config/passport.js');

//Bind connection to error event (to get notification of connection errors)
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;