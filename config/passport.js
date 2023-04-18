var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var userModel = mongoose.model('user');

passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
}, function(email, password, done) {
    userModel.findOne({ email: email }).then(function(user) {
        if (!user || !user.validPassword(password)) {
            return done(null, false, { errors: { 'auth': 'Login.errors.email_password_not_valid' } });
        }
        if (!user.companyInfo[0].active) {
            return done(null, false, { errors: { 'auth': 'Login.errors.company_inactive' } });
        }
        if (user.loginAttempts >= process.env.LOGIN_ATTEMPTS) {
            return done(null, false, { errors: { 'auth': 'Login.errors.account_locked' } });
        }
        if (!user.active) {
            return done(null, false, { errors: { 'auth': 'Login.errors.account_inactive' } });
        }
        if (user.deleted) {
            return done(null, false, { errors: { 'auth': 'Login.errors.account_deleted' } });
        }
        return done(null, user);
    }).catch(done);
}));