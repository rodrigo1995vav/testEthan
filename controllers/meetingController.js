var _ = require('lodash');
var moment = require('moment');
var generator = require('generate-password');
var fs = require('fs');
var crypto = require('crypto');

var meetingModel = require("../models/meetingModel");
var meetingMapper = require("../models/meetingMapper");
var attendeeMapper = require("../models/attendeeMapper");

var roomRedis = require("../services/roomRedis");

var mailer = require('../utilities/mailer');
var emailValidator = require('email-validator');


/* POST - Upload a document */
exports.upload = function(req, res) {
    if (req.file) {
        var allowedExtensions = ['.txt', '.csv', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.jpeg', '.jpg', '.gif', '.png'];
        var allowedTypes = [
            'text/plain', //.txt
            'text/csv', //.csv
            'application/pdf', //.pdf
            'application/msword', //.doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', //.docx
            'application/vnd.ms-excel', //.xls
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', //.xslx
            'application/vnd.ms-powerpoint', //.ppt
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', //.pptx
            'application/vnd.oasis.opendocument.text', //.odt
            'application/vnd.oasis.opendocument.spreadsheet', //.ods
            'application/vnd.oasis.opendocument.presentation', //.odp
            'image/jpeg', //.jpeg, .jpg
            'image/gif', //.gif
            'image/png' //.png
        ];

        if (allowedTypes.indexOf(req.file.mimetype)) {
            var ext = allowedExtensions[allowedTypes.indexOf(req.file.mimetype)];
            if (req.file.size < parseInt(process.env.FILE_MAX_SIZE) * 1000 * 1000) {
                fs.renameSync(req.file.path, req.file.path + ext);
                return res.status(200).json({ file: req.file.filename + ext });
            } else {
                return res.status(401).json({ errors: { file: "Docs.errors.file_too_large" } });
            }
        } else {
            return res.status(401).json({ errors: { file: "Docs.errors.file_type" } });
        }
    } else {
        return res.status(401).json({ errors: { file: "Not authorized" } });
    }
};


/* POST - Insert a new meeting */
exports.insert = async function(req, res) {
    var currentUser = req.payload.userInfo;
    //Ensuring Meeting start datetime is in the future
    if (new Date() > new Date(req.body.datetime)) {
        return res.status(401).json({ errors: { duration: "Meeting.errors.meeting_date_not_valid" } });
    }
    //Ensuring Meeting duration matches the duration of the items on the agenda
    var agendaDuration = 0;
    for (var i = 0; i < req.body.agenda.length; i++) {
        agendaDuration += _.toInteger(req.body.agenda[i].duration);
    }
    if (req.body.duration != agendaDuration) {
        return res.status(401).json({ errors: { duration: (req.body.agenda.duration > req.body.duration ? "Meeting.errors.meeting_shorter_agenda" : "Meeting.errors.agenda_shorter_meeting") } });
    }
    //Ensuring that the list of attendees is correct
    var attendeeErr = false;
    _.forEach(req.body.attendees, function(value, key) {
        if (!emailValidator.validate(value.email)) {
            attendeeErr = true;
        }
    });
    if (attendeeErr) {
        return res.status(401).json({ errors: { meeting: "Unable to process the request" } });
    }

    var meeting = new meetingModel();
    _.forEach(req.body, function(value, key) {
        if (_.indexOf(['subject', 'description', 'reference', 'type', 'datetime', 'secure', 'notes', 'duration', 'agenda'], key) >= 0)
            meeting[key] = value;
    });
    meeting.company = currentUser.company;
    meeting.user = currentUser._id;
    meeting.password = generator.generate({
        length: 8,
        numbers: true,
        symbols: true,
        lowercase: true,
        uppercase: true,
    });
    meeting.code = await meetingMapper.generateUid();
    req.body.docs.map((doc, i) => {
        var newURL = (doc.type == "link") ? value.url : crypto.createHash('sha1').update(crypto.randomBytes(20)).digest('hex') + doc.url;
        doc.created = new Date();
        if (doc.type != "link") {
            fs.renameSync('./public/tmp/' + doc.url, './public/docs/' + newURL);
        }
        doc.url = newURL;
        meeting.docs.push(doc);
    });

    meeting.save().then(function(meeting) {
        meetingMapper.saveGoals(req.body.goals, meeting);
        attendeeMapper.saveAttendees(req.body.attendees, meeting);
        return res.status(200).json({ message: "Meeting registration successful" });
    }).catch(function(err) {
        return res.status(401).json({ errors: { meeting: "Unable to process the request" } });
    });
};

/* GET - View meeting details */
exports.view = function(req, res) {
    var currentUser = req.payload.userInfo;
    if (_.isUndefined(req.params.id)) {
        return res.status(401).json({ errors: { meeting: "Meeting doesn't exist" } });
    }
    meetingModel.findById(req.params.id)
        .then(function(meeting) {
            return _.toString(currentUser.id) === _.toString(meeting.user) ? res.status(200).json({ meeting: meeting.toJSON() }) : es.status(401).json({ errors: { user: "User is unauthorized" } });
        }).catch(function(err) {
            return res.status(401).json({ errors: { meeting: "Meeting doesn't exist" } });
        });
};

/* PUT - Update meeting information */
exports.update = function(req, res) {
    var currentUser = req.payload.userInfo;

    if (_.isUndefined(req.params.id)) {
        return res.status(401).json({ errors: { meeting: "Meeting id required" } });
    }
    //Ensuring Meeting duration matches the duration of the items on the agenda
    var agendaDuration = 0;
    for (var i = 0; i < req.body.agenda.length; i++) {
        agendaDuration += _.toInteger(req.body.agenda[i].duration);
    }
    if (req.body.duration != agendaDuration) {
        return res.status(401).json({ errors: { duration: (req.body.agenda.duration > req.body.duration ? "Meeting.errors.meeting_shorter_agenda" : "Meeting.errors.agenda_shorter_meeting") } });
    }

    meetingModel.findById(req.params.id)
        .then(function(meeting) {
            var tbd = meeting.docs;
            //Ensuring Meeting start datetime is in the future
            if (meeting.status == "new" && new Date() > new Date(req.body.datetime)) {
                return res.status(401).json({ errors: { duration: "Meeting.errors.meeting_date_not_valid" } });
            }

            if (_.toString(currentUser.id) === _.toString(meeting.user)) {
                var status = meeting.status;
                _.forEach(req.body, function(value, key) {
                    if (_.indexOf(['subject', 'description', 'reference', 'type', 'datetime', 'secure', 'notes', 'duration', 'agenda'], key) >= 0)
                        meeting[key] = value;
                });
                switch (status) {
                    case "completed":
                        meetingMapper.updateGoals(req.body.goals, meeting);
                        break;
                    case "new":
                        meeting.docs = [];

                        req.body.docs.map((doc, i) => {
                            if (_.isUndefined(doc.created)) {
                                var newURL = (doc.type == "link") ? doc.url : crypto.createHash('sha1').update(crypto.randomBytes(20)).digest('hex') + doc.url;
                                doc.created = new Date();
                                if (doc.type != "link") {
                                    fs.renameSync('./public/tmp/' + doc.url, './public/docs/' + newURL);
                                }
                                doc.url = newURL;
                            } else {
                                var del = null;
                                for (var i = 0; i < tbd.length; i++) {
                                    if (tbd[i].url === doc.url) {
                                        del = i;
                                    }
                                }
                                tbd.splice(del, 1);
                            }
                            meeting.docs.push(doc);
                        });

                        tbd.map((d) => {
                            if (d.type !== "link") {
                                fs.unlinkSync('./public/docs/' + d.url);
                            }
                        });

                        meetingModel.findByIdAndUpdate({ _id: meeting._id }, meeting, { new: true }, function(err, result) {
                            meetingMapper.updateGoals(req.body.goals, meeting);
                            attendeeMapper.updateAttendees(req.body.attendees, meeting);
                        });
                        break;
                    default:
                }
                return res.status(200).json({ message: "Meeting updated successfully" });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            console.log(err);
            res.status(401).json({ errors: { meeting: "Meeting doesn't exist" } });
        });
};

/* GET - Restore meeting */
exports.restore = function(req, res) {
    var currentUser = req.payload.userInfo;
    if (_.isUndefined(req.params.id)) {
        return res.status(401).json({ errors: { meeting: "Meeting doesn't exist" } });
    }
    meetingModel.findById(req.params.id).select()
        .then(function(meeting) {
            if (_.toString(currentUser.id) === _.toString(meeting.user)) {
                meetingModel.findByIdAndUpdate({ _id: meeting._id }, { "status": "new", "lastUpdated": Date.now() }, { new: true }, function(err, result) {
                    return res.status(200).json({ message: "Meeting restored successfully" });
                });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            res.status(401).json({ errors: { meeting: "Meeting doesn't exist" } });
        });
};

/* DELETE - Cancel meeting */
exports.cancel = function(req, res) {
    var currentUser = req.payload.userInfo;
    if (_.isUndefined(req.params.id)) {
        return res.status(401).json({ errors: { meeting: "Meeting doesn't exist" } });
    }
    meetingModel.findById(req.params.id).select()
        .then(function(meeting) {
            if (_.toString(currentUser.id) === _.toString(meeting.user)) {
                meetingModel.findByIdAndUpdate({ _id: meeting._id }, { "status": "cancelled", "lastUpdated": Date.now() }, { new: true }, function(err, result) {
                    return res.status(200).json({ message: "Meeting cancelled successfully" });
                });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            res.status(401).json({ errors: { meeting: "Meeting doesn't exist" } });
        });
};

/* POST - Send meeting invitations */
exports.invite = function(req, res) {
    var currentUser = req.payload.userInfo;

    if (_.isUndefined(req.params.id)) {
        return res.status(401).json({ errors: { meeting: "Meeting id required" } });
    }

    meetingModel.findById(req.params.id)
        .then(function(meeting) {
            if (_.toString(currentUser.id) === _.toString(meeting.user)) {
                mailer.sendMeetingCommunication(req.body, meeting, req.params.method);
                return res.status(200).json({ message: "Invitations sent successfully" });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            res.status(401).json({ errors: { meeting: "Meeting doesn't exist" } });
        });
};

/* GET - Start meeting */
exports.start = function(req, res) {
    var currentUser = req.payload.userInfo;
    if (_.isUndefined(req.params.id)) {
        return res.status(401).json({ errors: { meeting: "Meeting doesn't exist" } });
    }
    meetingModel.findById(req.params.id).select()
        .then(function(meeting) {
            if (_.toString(currentUser.id) === _.toString(meeting.user)) {
                meetingModel.findByIdAndUpdate({ _id: meeting._id }, { "status": "started", "lastUpdated": Date.now() }, { new: true }, async function(err, meeting) {
                    var room = await roomRedis.getRoom("Room_" + meeting.id);
                    if (_.isNull(room)) {
                        roomRedis.createRoom(await meetingModel.findById(meeting.id));
                    }
                    return res.status(200).json({ message: "Meeting started successfully" });
                });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            res.status(401).json({ errors: { meeting: "Meeting doesn't exist" } });
        });
};

/* GET - Validate meeting code */
exports.validate = async function(req, res) {
    var currentUser = req.payload.userInfo;
    if (_.isUndefined(req.params.code) || !req.params.code.match(/^[0-9]{8,12}$/)) {
        return res.status(401).json({ errors: { meeting: "Meeting doesn't exist" } });
    }
    var temp = await meetingMapper.validateMeeting(req.params.code, currentUser);
    if (_.isNull(temp)) {
        return res.status(401).json({});
    } else {
        return res.status(200).json({ meeting: meetingMapper.cleanMeeting(temp.meeting) });
    }
};

/* POST - Upcoming meetings + previous meetings */
exports.index = async function(req, res) {
    var currentUser = req.payload.userInfo;

    if (!_.isString(req.body.startDate) || !_.isString(req.body.endDate)) {
        return res.status(401).json({ errors: "Enable to process the request" });
    }

    var startDate = new Date(req.body.startDate);
    var endDate = new Date(req.body.endDate);
    var now = new Date();
    if (endDate > now ||
        startDate >= endDate
    ) {
        return res.status(401).json({ errors: "Enable to process the request" });
    }
    startDate.setHours(0, 0, 0);
    endDate.setHours(23, 59, 59);

    var upcoming = [];
    var previous = [];
    var cancelled = [];
    try {
        if (req.body.upcoming) {
            upcoming = await meetingModel.find({
                    $and: [
                        { user: currentUser._id },
                        { company: currentUser.company },
                        { datetime: { $gte: new Date(moment().subtract(1, 'day').toISOString()) } },
                        { status: { $in: ["new", "started"] } }
                    ]
                })
                .sort([
                    ["datetime", "asc"]
                ]);
        }
        if (req.body.previous) {
            previous = await meetingModel.find({
                    $and: [
                        { user: currentUser._id },
                        { company: currentUser.company },
                        { datetime: { $lt: new Date(req.body.endDate) } },
                        { datetime: { $gte: new Date(req.body.startDate) } },
                        { status: { $in: ["new", "completed"] } }
                    ]
                })
                .sort([
                    ["datetime", "desc"],
                ]);
        }
        if (req.body.cancelled) {
            cancelled = await meetingModel.find({
                    $and: [
                        { user: currentUser._id },
                        { company: currentUser.company },
                        { status: { $in: ["cancelled"] } },
                        { datetime: { $gte: new Date(moment().subtract(1, 'day').toISOString()) } }
                    ]
                })
                .sort([
                    ["datetime", "desc"],
                ]);
        }
    } catch (err) { console.log(err) }

    return res.status(200).json({ upcoming: upcoming, previous: previous, cancelled: cancelled });
};