var _ = require('lodash');

var companyModel = require('../models/companyModel');
var userModel = require('../models/userModel');

var paramsvalidationUtility = require('../utilities/paramsvalidationUtility');
var mailer = require('../utilities/mailer');
var validator = require('email-validator');

/* POST - Send a message to Team-1.co */
exports.message = async function(req, res) {
    if (_.isUndefined(req.body.name) || _.isUndefined(req.body.email) || _.isUndefined(req.body.message)) {
        return res.status(401).json({});
    } else {
        mailer.message(req.body.email, req.body.name, req.body.message)
            .then(function() {});
        return res.status(200).json({ message: "message_sent_successfully" });
    }
};


/* POST - Register a company along with the main user */
exports.register = function(req, res) {
    if (req.body.password != req.body.password2) {
        return res.status(401).json({ errors: { password2: "ResetPassword.errors.password2" } });
    }
    if (!paramsvalidationUtility.validatePasswordLength(req.body.password)) {
        return res.status(401).json({ errors: { password: "Login.errors.password_length" } });
    }
    if (!_.isString(req.body.password) || !paramsvalidationUtility.validatePasswordComplexity(req.body.password)) {
        return res.status(401).json({ errors: { password: "Login.errors.password_complexity" } });
    }
    if (!validator.validate(req.body.email)) {
        return res.status(401).json({ errors: { email: "Login.errors.email_not_valid" } });
    }

    var company = new companyModel();
    _.forEach(req.body, function(value, key) {
        if (_.indexOf(['name', 'address', 'zipCode', 'city', 'province', 'country', 'phone'], key) >= 0)
            company[key] = value;
    });
    company.active = false;

    userModel.find({ email: req.body.email }).then(function(result) {
        if (result.length == 0) {
            company.save().then(function() {
                var user = new userModel();
                _.forEach(req.body, function(value, key) {
                    if (_.indexOf(['firstName', 'lastName', 'email', 'timezone'], key) >= 0)
                        user[key] = value;
                });
                user.role = "Superuser";
                user.generateLinkToken();
                user.company = company._id;
                user.setPassword(req.body.password);
                user.save().then(function() {

                    mailer.send(user.email,
                            'activate_' + req.body.language, {
                                link: process.env.WEB_URL + "activate/" + user.linkToken + "?lng=" + req.body.language
                            })
                        .then(function() {});

                    return res.status(200).json({ message: "Registration successful!" });
                }).catch(function(err) {
                    return res.status(401).send({ errors: { email: "Unable to process the request" } });
                });
            });
        } else {
            return res.status(401).json({ errors: { email: "Register.errors.email_already_used" } });
        }
    });

};