var _ = require('lodash');
var fs = require('fs');
var crypto = require('crypto');

var authRedis = require('../services/authRedis');

var meetingModel = require('../models/meetingModel');
var userModel = require('../models/userModel');
var taskModel = require('../models/taskModel');

var generator = require('generate-password');
var mailer = require('../utilities/mailer');
var validator = require('email-validator');

/* POST - Insert a new user */
exports.insert = function(req, res) {
    if (!validator.validate(req.body.email)) {
        return res.status(401).json({ errors: { email: "Login.errors.email_not_valid" } });
    }

    userModel.find({ email: req.body.email }).then(function(result) {
        if (result.length == 0) {
            var currentUser = req.payload.userInfo;

            var user = new userModel();
            _.forEach(req.body, function(value, key) {
                if (_.indexOf(['firstName', 'lastName', 'phone', 'email', 'role'], key) >= 0)
                    user[key] = value;
            });
            user.company = currentUser.company;
            user.timezone = currentUser.timezone;
            user.setPassword(generator.generate({
                length: 10,
                numbers: true,
                symbols: true,
                lowercase: true,
                uppercase: true,
            }));
            user.generateLinkToken();

            user.save().then(function() {
                mailer.send(user.email,
                        'activate_guest_' + req.body.language, {
                            link: process.env.WEB_URL + "activate_guest/" + user.linkToken + "?lng=" + req.body.language
                        })
                    .then(function() {});

                return res.status(200).json({ message: "User registration successful" });

            }).catch(function(err) {
                return res.status(401).json({ errors: { email: "Unable to process the request" } });
            });
        } else {
            return res.status(401).json({ errors: { email: "Register.errors.email_already_used" } });
        }
    });

};

/* GET - View user details */
exports.view = function(req, res) {
    var currentUser = req.payload.userInfo;
    if (_.isUndefined(req.params.id)) {
        req.params.id = currentUser._id;
    }
    userModel.findById(req.params.id)
        .then(function(targetUser) {
            if (currentUser.role == "Admin" ||
                (currentUser.role == "Superuser" && _.toString(currentUser.company) === _.toString(targetUser.company)) ||
                (currentUser.role == "User" && _.toString(currentUser._id) === _.toString(targetUser._id))
            ) {
                var user = targetUser.toJSON();
                _.unset(user, "salt");
                _.unset(user, "hash");
                _.unset(user, "linkToken");
                _.unset(user, "linkTokenExp");
                _.unset(user, "loginAttempts");
                if (currentUser.role == "User") {
                    _.unset(user, "companyInfo");
                }
                return res.status(200).json({ user: user });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            console.log(err);
            return res.status(401).json({ errors: { user: "User doesn't exist" } });
        });
};

/* PUT - Update my profile */
exports.profile = function(req, res) {
    var currentUser = req.payload.userInfo;
    userModel.findById(currentUser.id).select(['_id', 'firstName', 'lastName', 'email', 'active', 'loginAttempts', 'deleted', 'company'])
        .then(function(targetUser) {
            var user = {};
            user.phone = req.body.phone;
            user.timezone = req.body.timezone;
            user.lastUpdated = Date.now();
            userModel.findByIdAndUpdate({ _id: targetUser._id }, user, { new: true }, function(err, result) {});

            authRedis.updateUser(currentUser, { phone: req.body.phone, timezone: req.body.timezone });
            return res.status(200).json({ message: "User updated successfully" })
        }).catch(function(err) {
            return res.status(401).json({ errors: { user: "User doesn't exist" } });
        });
};

/* POST - Update my picture */
exports.picture = function(req, res) {
    if (req.body.picture) {
        var result = req.body.picture.match(/^data:image\/(png|jpeg|jpg|gif)\;([a-zA-Z0-9]+)\,(.*)$/);
        if (_.isArray(result) && result.length == 4) {
            var sizeInMB = Buffer.byteLength(result[3], result[2]) / 1000 / 1000;

            if (sizeInMB > process.env.PICTURE_MAX_SIZE) {
                return res.status(401).json({ errors: { picture: "Not authorized" } });
            }
            var filename = crypto.createHash('sha1').update(crypto.randomBytes(30) + req.payload.token).digest('hex');
            filename = filename + '.' + result[1];
            //Deleting previous picture if any
            if (_.isString(req.payload.userInfo.picture) && req.payload.userInfo.picture.length > 0 && fs.existsSync('./public/avatars/' + req.payload.userInfo.picture)) {
                fs.unlinkSync('./public/avatars/' + req.payload.userInfo.picture);
            }
            //Saving the new picture
            fs.writeFile('./public/avatars/' + filename, result[3], { encoding: result[2] }, function(err) {
                userModel.findByIdAndUpdate({ _id: req.payload.user }, { picture: filename }, { new: true }, function(err, result) {
                    authRedis.updateUser(req.payload.userInfo, { picture: filename });
                    return res.status(200).json({ picture: filename });
                });
            });
        } else {
            return res.status(401).json({ errors: { picture: "Not authorized" } });
        }
    } else {
        return res.status(401).json({ errors: { picture: "Not authorized" } });
    }
};

/* PUT - Update user information */
exports.update = function(req, res) {
    var currentUser = req.payload.userInfo;
    userModel.findById(req.params.id).select()
        .then(function(targetUser) {
            if (currentUser.role == "Admin" ||
                (currentUser.role == "Superuser" && _.toString(currentUser.company) == _.toString(targetUser.company)) ||
                (currentUser.role == "User" && _.toString(currentUser._id) == _.toString(targetUser._id))
            ) {
                var user = {};
                user.id = req.params.id;
                _.forEach(req.body, function(value, key) {
                    if (_.indexOf(['firstName', 'lastName', 'email', 'phone', 'role'], key) >= 0) {
                        user[key] = value;
                    }
                });
                user.lastUpdated = Date.now();
                switch (req.body.status) {
                    case "inactive":
                        user.deleted = false;
                        user.active = false;
                        break;
                    case "active":
                        user.deleted = false;
                        user.active = true;
                        user.loginAttempts = 0;
                        break;
                    case "locked":
                        user.deleted = false;
                        user.active = true;
                        user.loginAttempts = (process.env.LOGIN_ATTEMPTS + 1);
                        break;
                }
                authRedis.saveUser(user);
                userModel.findByIdAndUpdate({ _id: targetUser._id }, user, { new: true }, function(err, result) {
                    if (_.isNull(err)) {
                        return res.status(200).json({ message: "User updated successfully" });
                    } else {
                        return res.status(401).json({ errors: { email: "Register.errors.email_already_used" } });
                    }
                });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            res.status(401).json({ errors: { user: "User doesn't exist" } });
        });
};

/* DELETE - Delete user */
exports.delete = function(req, res) {
    var currentUser = req.payload.userInfo;
    userModel.findById(req.params.id).select()
        .then(function(targetUser) {
            if (currentUser.role == "Admin" ||
                (currentUser.role == "Superuser" && _.toString(currentUser.company) == _.toString(targetUser.company))
            ) {
                userModel.findByIdAndUpdate({ _id: targetUser._id }, { "deleted": true, "lastUpdated": Date.now() }, { new: true }, function(err, result) {
                    authRedis.deleteUser(targetUser);
                    return res.status(200).json({ message: "User deleted successfully" });
                });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            res.status(401).json({ errors: { user: "User doesn't exist" } });
        });
};

/* GET - List all the users within the same company that are active and not deleted */
exports.colleagues = function(req, res) {
    var currentUser = req.payload.userInfo;
    userModel.find({
            $and: [
                { company: currentUser.company },
                { deleted: false },
                { active: true },
                { email: { $nin: [currentUser.email] } }
            ]
        })
        .select(['_id', 'firstName', 'lastName', 'email'])
        .sort([
            ['lastName', 'asc']
        ])
        .exec(function(err, users) {
            res.status(200).json({ users: users });
        });
};

/* GET - User dashboard */
exports.dashboard = async function(req, res) {
    var currentUser = req.payload.userInfo;
    console.log(currentUser);
    var dashboard = {};

    dashboard.colleagues = await userModel.find({
        $and: [
            { company: currentUser.company },
            { deleted: false },
            { active: true },
            { email: { $nin: [currentUser.email] } }
        ]
    });
    dashboard.colleagues = dashboard.colleagues.length;

    dashboard.tasks = {};

    dashboard.tasks.created = await taskModel.find({
        $and: [
            { deleted: false },
            { createdBy: currentUser.id }
        ]
    });
    dashboard.tasks.created = dashboard.tasks.created.length;

    dashboard.tasks.assigned = await taskModel.find({
        $and: [
            { deleted: false },
            { status: { $nin: ['cancelled', 'resolved', 'closed'] } },
            { assignedTo: currentUser.id }
        ]
    });

    dashboard.tasks.p1 = dashboard.tasks.p3 = dashboard.tasks.p5 = 0;
    dashboard.tasks.assigned.map((task) => {
        dashboard.tasks[task.priority]++;
    });
    dashboard.tasks.bug = dashboard.tasks.feature = dashboard.tasks.change = dashboard.tasks.task = dashboard.tasks.request = 0;
    dashboard.tasks.assigned.map((task) => {
        dashboard.tasks[task.type]++;
    });

    dashboard.tasks.assigned = dashboard.tasks.assigned.length;

    dashboard.meetings = {};
    dashboard.meetings.new = await meetingModel.find({
        $and: [
            { user: currentUser.id },
            { status: 'new' }
        ]
    });
    dashboard.meetings.new = dashboard.meetings.new.length;

    dashboard.meetings.completed = await meetingModel.find({
        $and: [
            { user: currentUser.id },
            { status: 'completed' }
        ]
    });
    dashboard.meetings.completed = dashboard.meetings.completed.length;

    dashboard.meetings.cancelled = await meetingModel.find({
        $and: [
            { user: currentUser.id },
            { status: 'cancelled' }
        ]
    });
    dashboard.meetings.cancelled = dashboard.meetings.cancelled.length;


    res.status(200).json({ dashboard: dashboard });
};


/* POST - List all the users within the same company */
exports.index = function(req, res) {
    var currentUser = req.payload.userInfo;

    userModel.find({
            $and: [
                { company: currentUser.company },
                { deleted: false }
            ]
        })
        .select(['_id', 'firstName', 'lastName', 'email', 'active', 'phone', 'loginAttempts', 'deleted', 'created', 'lastUpdated', 'lastLoginDate', 'role'])
        .sort([
            ['created', 'desc']
        ])
        .exec(function(err, users) {
            res.status(200).json({ users: users });
        });
};