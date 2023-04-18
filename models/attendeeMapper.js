var _ = require('lodash');
var jwt = require('jsonwebtoken');

var attendeeModel = require("../models/attendeeModel");

exports.saveAttendees = function(items, meeting) {
    _.forEach(items, function(value, key) {
        var attendee = new attendeeModel();
        attendee.meeting = meeting.id;
        attendee.email = value.email;
        attendee.user = value.user;
        attendee.fullName = value.fullName;
        attendee.presence = value.presence;
        attendee.type = value.type;
        attendee.order = key + 1;
        attendee.save().then(function(attendee) {});
    });
}

exports.updateAttendees = function(items, meeting) {
    attendeeModel.find({ meeting: meeting._id }).then(function(result) {
        var present = [];
        for (var i = 0; i < result.length; i++) {
            present.push(_.toString(result[i]._id));
        }
        _.forEach(items, function(value, key) {
            present.splice(_.indexOf(present, _.toString(value._id)), 1);
            if (_.isString(value._id) && value.meeting == meeting._id) {
                attendeeModel.findByIdAndUpdate({ _id: value._id }, { email: value.email, presence: value.presence, type: value.type, order: key + 1, lastUpdated: new Date() },
                    function(err, result) {});
            } else {
                var attendee = new attendeeModel();
                attendee.meeting = meeting.id;
                attendee.email = value.email;
                attendee.user = value.user;
                attendee.fullName = value.fullName;
                attendee.presence = value.presence;
                attendee.type = value.type;
                attendee.order = key + 1;
                attendee.save().then(function(attendee) {});
            }
        });
        if (present.length > 0) {
            attendeeModel.deleteMany({ '_id': { '$in': present } }).then();
        }
    });
}

exports.updateAttendeesAsync = async function(items, meeting) {
    for (var i = 0; i < items.length; i++) {
        let value = items[i];
        if (_.isString(value._id) && value.meeting == meeting._id) {
            var updates = {
                lastUpdated: new Date(),
                order: i + 1
            }
            let r = await attendeeModel.findByIdAndUpdate({ _id: value._id }, updates);
        } else {
            var attendee = new attendeeModel();
            attendee.meeting = meeting.id;
            attendee.email = value.email;
            attendee.user = value.user;
            attendee.fullName = value.fullName;
            attendee.presence = value.presence;
            attendee.type = value.type;
            attendee.order = i + 1;
            let r = await attendee.save();
        }
    }
    return await attendeeModel.find({ meeting: meeting._id }).sort({ order: 'asc' });
}