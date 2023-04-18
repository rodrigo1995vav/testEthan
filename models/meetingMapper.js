var _ = require('lodash');
var getUid = require('get-uid');
var fs = require('fs');
var crypto = require('crypto');

var meetingModel = require("../models/meetingModel");
var goalModel = require("../models/goalModel");

exports.generateUid = async function() {
    var code = null;
    do {
        try {
            code = getUid().toString();
            code = code.substr(0, 3) + "-" + code.substr(3, 3) + "-" + code.substr(6);
            var result = await meetingModel.find({ code: code });
            code = (result.length == 0) ? code : null;
        } catch (err) { console.log(err) };
    } while (_.isNull(code));
    return code;
}


exports.saveGoals = function(items, meeting) {
    _.forEach(items, function(value, key) {
        var goal = new goalModel();
        goal.meeting = meeting.id;
        goal.item = value.item;
        goal.priority = value.priority;
        goal.order = key + 1;
        goal.save().then(function(goal) {});
    });
}


exports.updateGoals = function(items, meeting) {
    goalModel.find({ meeting: meeting._id }).then(function(result) {
        var present = [];
        for (var i = 0; i < result.length; i++) {
            present.push(_.toString(result[i]._id));
        }
        _.forEach(items, function(value, key) {
            if (_.isString(value._id) && value.meeting == meeting._id) {
                present.splice(_.indexOf(present, _.toString(value._id)), 1);
                var updates = {
                    lastUpdated: new Date(),
                    order: key + 1,
                    completed: value.completed
                }
                if (value.additional) {
                    updates.item = value.item;
                    updates.priority = value.priority;
                }
                goalModel.findByIdAndUpdate({ _id: value._id }, updates, function(err, result) {});
            } else {
                var goal = new goalModel();
                goal.meeting = meeting.id;
                goal.item = value.item;
                goal.priority = value.priority;
                goal.completed = value.completed;
                goal.additional = value.additional;
                goal.order = key + 1;
                goal.save().then(function(goal) {});
            }
        });
        if (present.length > 0) {
            goalModel.deleteMany({ '_id': { '$in': present } }).then();
        }
    });
}

exports.updateGoalsAsync = async function(items, meeting) {
    for (var i = 0; i < items.length; i++) {
        let value = items[i];
        if (_.isString(value._id) && value.meeting == meeting._id) {
            var updates = {
                lastUpdated: new Date(),
                completed: value.completed,
                order: i + 1
            }
            if (value.additional) {
                updates.item = value.item;
                updates.priority = value.priority;
            }
            let r = await goalModel.findByIdAndUpdate({ _id: value._id }, updates);
        } else {
            var goal = new goalModel();
            goal.meeting = meeting.id;
            goal.item = value.item;
            goal.priority = value.priority;
            goal.completed = value.completed;
            goal.additional = value.additional;
            goal.order = i + 1;
            let r = await goal.save();
        }
    }
    return await goalModel.find({ meeting: meeting._id }).sort({ order: 'asc' });
}


exports.cleanMeeting = function(meeting) {
    meeting = meeting.toJSON();
    var toBeRemoved = ['_id', 'user', 'companyInfo', 'id',
        'userInfo[0].active', 'userInfo[0].deleted', 'userInfo[0].id', 'userInfo[0]._id', 'userInfo[0].companyInfo',
        'communications'
    ];

    toBeRemoved.map(function(value) {
        _.unset(meeting, value);
    });

    toBeRemoved = ['_id', 'created', 'lastUpdated', 'meeting', '__v', 'id'];
    meeting.attendees.map(function(value, index) {
        toBeRemoved.map(function(val) {
            _.unset(meeting.attendees[index], val);
        })
    });

    toBeRemoved = ['_id', 'created', 'lastUpdated', '__v'];
    meeting.goals.map(function(value, index) {
        toBeRemoved.map(function(val) {
            _.unset(meeting.goals[index], val);
        })
    });

    return meeting;
}

exports.validateMeeting = async function(code, user) {
    if (code.indexOf('-') < 0) {
        code = code.substr(0, 3) + "-" + code.substr(3, 3) + "-" + code.substr(6);
    }
    var meeting = await meetingModel.findOne({
        $and: [
            { code: code },
            { status: { $in: ["new", "started", "completed"] } }
            /*,
                        { datetime: { $lt: new Date(moment().add(process.env.MEETING_LIFE, 'hours')) } },
                        { datetime: { $gt: new Date(moment().subtract(process.env.MEETING_LIFE, 'hours')) } }*/
        ]
    }).select(["subject", "description", "type", "code", "datetime", "duration", "secure", "status", "user", "password", "agenda", "docs"]);

    if (_.isNull(meeting)) {
        return null;
    } else {
        var participating = (user.id == meeting.user ? "organizer" : false);
        if (!participating) {
            for (var i = 0; i < meeting.attendees.length; i++) {
                if (meeting.attendees[i].user == user.id) {
                    participating = meeting.attendees[i].type;
                }
            }
        }
        return !participating ? null : { meeting: meeting, type: participating };
    }
}