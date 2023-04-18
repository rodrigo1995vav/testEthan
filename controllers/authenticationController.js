var _ = require('lodash');
var passport = require('passport');
const requestIp = require('request-ip');

var companyModel = require('../models/companyModel');
var userModel = require('../models/userModel');
var tokenModel = require('../models/tokenModel');

var authRedis = require('../services/authRedis');

var paramsvalidationUtility = require('../utilities/paramsvalidationUtility');
var mailer = require('../utilities/mailer');

var validator = require('email-validator');

/* POST - Login */
exports.login = function(req, res, next) {
    passport.authenticate('local', { session: false }, function(err, user, info) {
        if (err) { return next(err); }
        if (user) {

            var tokenAuth = user.toAuthJSON();
            userModel.findByIdAndUpdate({ _id: user._id }, {
                lastLoginDate: Date.now(),
                loginAttempts: 0
            }, function(err, result) {});

            var token = new tokenModel();
            token.user = user.id;
            token.token = tokenAuth.token;
            token.refreshToken = tokenAuth.refreshToken;
            token.loginAttempts = 0;
            token.ip = requestIp.getClientIp(req);

            authRedis.login(token, user);

            token.save().then(function() {
                return res.status(200).json({ user: tokenAuth });
            }).catch(next);
        } else {
            userModel.findOneAndUpdate({ email: req.body.username }, { $inc: { loginAttempts: 1 } }, function(err, result) {});
            return res.status(401).json(info);
        }
    })(req, res, next);
};

/* POST - Activate account (company and user) */
exports.activate = function(req, res) {
    userModel.find({ linkToken: req.body.token }).then(function(result) {
        if (result.length == 1 &&
            result[0].linkTokenExp > Date.now() &&
            !result[0].active &&
            !result[0].deleted &&
            result[0].loginAttempts < 5 &&
            !result[0].companyInfo[0].active) {
            var user = result[0];
            user.lastUpdated = Date.now();
            user.linkToken = "";
            user.linkTokenExp = Date.now();
            user.active = true;
            userModel.findByIdAndUpdate({ _id: user._id }, user, { new: true }, function(err, result) {
                companyModel.findByIdAndUpdate({ _id: user.company }, { active: true }, function(err, result) {});
                return res.status(200).json({ message: "Account activated successfully!" })
            });
        } else {
            return res.status(401).json({ error: "Invalid token!" });
        }
    });
};

/* POST - Check guest activation token */
exports.gCheckToken = function(req, res) {
    userModel.find({ linkToken: req.body.token }).then(function(result) {
        if (result.length == 1 && result[0].linkTokenExp > Date.now() &&
            !result[0].active &&
            !result[0].deleted &&
            result[0].loginAttempts < 5 &&
            result[0].companyInfo[0].active) {
            return res.status(200).json({ message: "Valid token!" })
        } else {
            return res.status(401).json({ error: "Invalid token!" });
        }
    });
};

/* POST - Set password used by guest when activating account */
exports.gSetPassword = function(req, res) {
    if (!paramsvalidationUtility.validatePasswordLength(req.body.password)) {
        return res.status(401).json({ errors: { password: "Login.errors.password_length" } });
    }
    if (!_.isString(req.body.password) || !paramsvalidationUtility.validatePasswordComplexity(req.body.password)) {
        return res.status(401).json({ errors: { password: "Login.errors.password_complexity" } });
    }
    if (req.body.password != req.body.password2) {
        return res.status(401).json({ errors: { password2: "ResetPassword.errors.password2" } });
    }

    userModel.find({ linkToken: req.body.token }).then(function(result) {
        if (result.length == 1 && result[0].linkTokenExp > Date.now() &&
            !result[0].active &&
            !result[0].deleted &&
            result[0].loginAttempts < 5 &&
            result[0].companyInfo[0].active) {
            var user = result[0];
            user.setPassword(req.body.password);
            userModel.findByIdAndUpdate({ _id: user._id }, {
                    "salt": user.salt,
                    "hash": user.hash,
                    "active": true,
                    "lastUpdated": Date.now(),
                    "linkToken": "",
                    "linkTokenExp": Date.now()
                }, { new: true },
                function(err, result) {
                    return res.status(200).json({ message: "Password changed successfully!" });
                });
        } else {
            return res.status(401).json({ error: "Invalid token!" });
        }
    });
};

/* POST - Forget password */
exports.forgetPassword = function(req, res) {
    if (!validator.validate(req.body.email)) {
        return res.status(401).json({ errors: { email: "Login.errors.email_not_valid" } });
    }
    userModel.find({ email: req.body.email }).then(function(result) {
        if (result.length == 1 &&
            result[0].active &&
            !result[0].deleted &&
            result[0].companyInfo[0].active) {
            var user = result[0];

            if (user.loginAttempts >= 5) {
                return res.status(401).json({ errors: { email: "Login.errors.account_locked" } });
            } else {
                user.lastUpdated = Date.now();
                user.generateLinkToken();
                userModel.findByIdAndUpdate({ _id: user._id }, user, { new: true }, function(err, result) {
                    mailer.send(user.email,
                            'forgot_password_' + req.body.language, {
                                firstName: user.firstName,
                                lastName: user.lastName,
                                email: user.email,
                                link: process.env.WEB_URL + "reset_password/" + user.linkToken + "?lng=" + req.body.language
                            })
                        .then(function() {});

                    return res.status(200).json({ message: "Email sent successfully!" });
                });
            }

        } else {
            return res.status(401).json({ errors: { email: "Login.errors.email_not_found" } });
        }
    });
};

/* POST - Check forget password token */
exports.fpCheckToken = function(req, res) {
    userModel.find({ linkToken: req.body.token }).then(function(result) {
        if (result.length == 1 && result[0].linkTokenExp > Date.now() &&
            result[0].active &&
            !result[0].deleted &&
            result[0].loginAttempts < 5 &&
            result[0].companyInfo[0].active) {
            return res.status(200).json({ message: "Valid token!" })
        } else {
            return res.status(401).json({ error: "Invalid token!" });
        }
    });
};

/* POST - Reset password using the forget password token */
exports.resetPassword = function(req, res) {
    if (!paramsvalidationUtility.validatePasswordLength(req.body.password)) {
        return res.status(401).json({ errors: { password: "Login.errors.password_length" } });
    }
    if (!_.isString(req.body.password) || !paramsvalidationUtility.validatePasswordComplexity(req.body.password)) {
        return res.status(401).json({ errors: { password: "Login.errors.password_complexity" } });
    }
    if (req.body.password != req.body.password2) {
        return res.status(401).json({ errors: { password2: "ResetPassword.errors.password2" } });
    }

    userModel.find({ linkToken: req.body.token }).then(function(result) {
        if (result.length == 1 && result[0].linkTokenExp > Date.now() &&
            result[0].active &&
            !result[0].deleted &&
            result[0].loginAttempts < 5 &&
            result[0].companyInfo[0].active) {
            var user = result[0];
            user.setPassword(req.body.password);
            userModel.findByIdAndUpdate({ _id: user._id }, {
                    "salt": user.salt,
                    "hash": user.hash,
                    "lastUpdated": Date.now(),
                    "linkToken": "",
                    "linkTokenExp": Date.now()
                }, { new: true },
                function(err, result) {
                    return res.status(200).json({ message: "Password changed successfully!" });
                });
        } else {
            return res.status(401).json({ error: "Invalid token!" });
        }
    });
};

/* POST - Change password */
exports.changePassword = function(req, res) {
    if (!paramsvalidationUtility.validatePasswordLength(req.body.password)) {
        return res.status(401).json({ errors: { password: "Login.errors.password_length" } });
    }
    if (!_.isString(req.body.password) || !paramsvalidationUtility.validatePasswordComplexity(req.body.password)) {
        return res.status(401).json({ errors: { password: "Login.errors.password_complexity" } });
    }
    if (req.body.password != req.body.password2) {
        return res.status(401).json({ errors: { password2: "ResetPassword.errors.password2" } });
    }
    if (req.body.currentPassword == req.body.password) {
        return res.status(401).json({ errors: { password: "ChangePassword.errors.current_password" } });
    }

    userModel.findById(req.payload.user).then(function(currentUser) {
        if (currentUser.validPassword(req.body.currentPassword)) {
            currentUser.setPassword(req.body.password);
            userModel.findByIdAndUpdate({ _id: currentUser._id }, { "salt": currentUser.salt, "hash": currentUser.hash, "lastUpdated": Date.now() }, { new: true }, function(err, result) {
                return res.status(200).json({ message: "Password changed successfully!" });
            });
        } else {
            return res.status(401).json({ errors: { currentPassword: "ChangePassword.errors.current_password_not_valid" } });
        }
    });
};

/* GET - Refresh/extend token once the user has generated one*/
exports.refresh = function(req, res) {
    userModel.findById(req.payload.user).then(function(user) {
        var token = user.generateJWT();
        tokenModel.findByIdAndUpdate({ _id: req.payload._id }, { "token": token, "lastUpdated": Date.now() }, function(err, result) {
            if (!_.isEmpty(result)) {
                result.token = token;
                result.lastUpdate = Date.now();
                authRedis.refreshToken(req.payload.token, result);
                authRedis.saveUser(req.payload.userInfo);
                return res.json({ token: token });
            } else {
                return res.status(401).json({ errors: { token: "Token doesn't exist" } });
            }
        });
    });
};

/* GET - Check token while user is connected */
exports.check = function(req, res) {
    return res.status(200).json({ result: "Token valid" });
};

/* GET - Logout */
exports.logout = function(req, res) {
    tokenModel.findByIdAndUpdate({ _id: req.payload._id }, { "active": false, "lastUpdated": Date.now() }, function(err, result) {
        if (!_.isEmpty(result)) {
            authRedis.logout(req.payload);
            return res.status(200).json({ message: "Logout successful" });
        } else {
            return res.status(401).json({ errors: { token: " doesn't exist" } });
        }
    });
};