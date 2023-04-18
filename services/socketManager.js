var _ = require('lodash');
var fs = require('fs');

var authRedis = require('../services/authRedis');
var roomRedis = require('../services/roomRedis');

var meetingMapper = require('../models/meetingMapper');
var attendeeMapper = require('../models/attendeeMapper');

const client = require('../config/redis');
const meetingModel = require('../models/meetingModel');
const goalModel = require('../models/goalModel');

exports.index = async function(socket, io) {
    var queries = socket.client.request._query;
    //PARAMS
    var socketID = socket.id;
    var meetingCode = queries.code;
    var action = queries.action;

    var authToken = queries.token;
    var user = {};
    var token = await authRedis.getToken('Token', authToken);
    if (_.isNull(token)) {
        socket.disconnect();
        return false;
    } else {
        user = await authRedis.getUser(token.user);
    }

    var temp = await meetingMapper.validateMeeting(meetingCode, user);
    if (_.isNull(temp)) {
        socket.disconnect();
        return false;
    }
    var meeting = temp.meeting;
    user.type = temp.type;

    console.log('NEW CONNECTION', {
        'Meeting': meetingCode,
        'User': user.email,
        'SocketID': socketID,
        'Action': action,
        'Date': new Date()
    });
    var roomID = "Room_" + meeting.id;
    var timeOut = null;

    switch (action) {
        case "preMeeting":
            timeOut = setTimeout(() => updateStatus(io, socket, meetingCode, user), (60 - (new Date()).getSeconds()) * 1000);
            break;

        case "duringMeeting":
            var room = await roomRedis.getRoom(roomID);

            if (_.isNull(room)) {
                socket.disconnect();
                return false;
            } else {
                socket.join(roomID);

                room.sockets.push({
                    socketID: socketID,
                    user: user,
                });
                if (room.participants.indexOf(user.email) < 0) {
                    room.participants.push(user.email);
                }
                roomRedis.saveRoom(room);
                socket.emit('syncMeeting', syncMeeting(user, room, ['goals', 'docs', 'participants', 'chat', 'questions', 'notes', 'settings', 'whiteboard', 'ideation', 'votes', 'project'], null));

                socket.to(roomID).emit('updateParticipants', { participants: room.participants });

                socket.on("endMeeting", (p, fn) => endMeeting(io, user, roomID, p, fn));
                socket.on("updateSettings", (settings, fn) => updateSettings(io, user, roomID, settings, fn));

                socket.on("newMsg", (msg, fn) => newMsg(io, user, roomID, msg, fn));
                socket.on("newQuestion", (question, fn) => newQuestion(io, user, roomID, question, fn));
                socket.on("answerQuestion", (item, fn) => answerQuestion(io, user, roomID, item, fn));

                socket.on("additionalParticipant", (participant, fn) => additionalParticipant(io, user, meeting, roomID, participant, fn));

                socket.on("meetingObjective", (objective, fn) => meetingObjective(io, user, meeting, roomID, objective, fn));
                socket.on("deleteMeetingObjective", (objective, fn) => deleteMeetingObjective(io, user, meeting, roomID, objective, fn));

                socket.on("meetingDoc", (doc, fn) => meetingDoc(io, user, meeting, roomID, doc, fn));
                socket.on("deleteMeetingDoc", (doc, fn) => deleteMeetingDoc(io, user, meeting, roomID, doc, fn));

                socket.on("whiteboard", (items, fn) => whiteboard(io, user, roomID, items, fn));
                socket.on("ideation", (items, fn) => ideation(io, user, roomID, items, fn));
                socket.on("votes", (items, fn) => votes(io, user, roomID, items, fn));
                socket.on("voteSubmit", (items, fn) => voteSubmit(io, user, roomID, items, fn));
                socket.on("project", (items, fn) => project(io, user, roomID, items, fn));
                socket.on("updateNotes", (notes, fn) => updateNotes(io, user, roomID, notes, fn));

                //io.adapter.sockets.in(room).emit('newAttendee', { attendee, attendee }); => Broadcasting to all clients in one room
                //socket.broadcast.to(id).emit('my message', msg); => Sending message to a specific socket
                //socket.broadcast.emit('hello', 'to all clients except sender'); => Sending message to all clients except sender
            }
            break;
        default:
            socket.disconnect();
    }

    socket.on("disconnect", () => disconnect(io, timeOut, action, socket, meetingCode, user, roomID));
}

/********************************************************************************************/

updateStatus = async function(io, socket, meetingCode, user) {
    console.log('UPDATE STATUS', {
        'Meeting': meetingCode,
        'User': user.email,
        'SocketID': socket.id,
        'Date': new Date()
    });
    var temp = await meetingMapper.validateMeeting(meetingCode, user);

    var clients = await io.clients();
    if (!_.isUndefined(clients.sockets[socket.id])) {
        socket.emit("updateStatus", {
            meeting: !_.isNull(temp) ? meetingMapper.cleanMeeting(temp.meeting) : null
        });
        setTimeout(() => updateStatus(io, socket, meetingCode, user), 15000);
    }
}

whiteboard = async function(io, user, roomID, items, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (!_.isNull(room) && (room.settings.whiteboard === user.email)) {
        room.whiteboard = items;
        roomRedis.saveRoom(room);
        io.to(roomID).emit('syncMeeting', syncMeeting(user, room, ['whiteboard'], null));
        fn("OK");
    } else {
        fn("FAILED");
    }
}

ideation = async function(io, user, roomID, items, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (!_.isNull(room) && (room.settings.ideation === user.email)) {
        room.ideation = items;
        roomRedis.saveRoom(room);
        io.to(roomID).emit('syncMeeting', syncMeeting(user, room, ['ideation'], null));
        fn("OK");
    } else {
        fn("FAILED");
    }
}

votes = async function(io, user, roomID, items, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (!_.isNull(room) && (room.settings.votes === user.email)) {
        room.votes = items;
        roomRedis.saveRoom(room);
        io.to(roomID).emit('syncMeeting', syncMeeting(user, room, ['votes'], null));
        fn("OK");
    } else {
        fn("FAILED");
    }
}

voteSubmit = async function(io, user, roomID, items, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (!_.isNull(room)) {
        if (room.votes[items.key].participants.indexOf(user.email) < 0 && room.votes[items.key].title === items.vote.title) {
            room.votes[items.key].participants.push(user.email);
            room.votes[items.key].results[items.value] += 1;
            roomRedis.saveRoom(room);
            io.to(roomID).emit('syncMeeting', syncMeeting(user, room, ['votes'], null));
            fn("OK");
        } else {
            fn("FAILED");
        }
    } else {
        fn("FAILED");
    }
}

project = async function(io, user, roomID, items, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (!_.isNull(room) && (room.settings.project === user.email)) {
        room.project = items;
        roomRedis.saveRoom(room);
        io.to(roomID).emit('syncMeeting', syncMeeting(user, room, ['project'], null));
        fn("OK");
    } else {
        fn("FAILED");
    }
}

updateNotes = async function(io, user, roomID, notes, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (!_.isNull(room)) {
        room.notes[user.email] = notes;
        roomRedis.saveRoom(room);
        fn("OK");
    } else {
        fn("FAILED");
    }
}

/********************************************************************************************/
syncMeeting = function(user, room, data, notifications) {
    var r = {};
    data.map((v) => {
        if (['participants', 'chat', 'questions', 'notes', 'settings', 'whiteboard', 'ideation', 'votes', 'project'].indexOf(v) >= 0) {
            if (v === 'notes') {
                r[v] = !_.isUndefined(room['notes'][user.email]) ? room['notes'][user.email] : "";
            } else {
                r[v] = room[v];
            }
        } else {
            r[v] = room.meeting[v];
        }
    });
    r.notifications = notifications;
    return r;
}

endMeeting = async function(io, user, roomID, p, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (user.type !== "organizer" || _.isNull(room)) {
        fn("FAILED");
    } else {
        fn("OK");
        await meetingModel.findByIdAndUpdate({ _id: room.meeting._id }, { room: room, status: 'completed' }, { new: true });
        roomRedis.closeRoom(roomID);
        io.to(roomID).emit('disconnect');
    }
}

updateSettings = async function(io, user, roomID, settings, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (user.type === "guest" || _.isNull(room)) {
        fn("FAILED");
    } else {
        var toSync = ['settings'];
        if (room.settings.project != settings.project) {
            room.project = {
                id: null,
                details: null,
                tasks: [],
                board: {
                    columns: []
                },
                members: {}
            };
            toSync.push('project');
        }
        room.settings = settings;
        roomRedis.saveRoom(room);
        io.to(roomID).emit('syncMeeting', syncMeeting(user, room, toSync, null));
        fn("OK");
    }
}

additionalParticipant = async function(io, user, meeting, roomID, participant, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (_.isNull(room) || user.type == "guest") {
        fn("failed");
    } else {
        participant.meeting = meeting.id;
        room.meeting.attendees.push(participant);
        room.meeting.attendees = _.orderBy(room.meeting.attendees, ['presence', 'type', 'fullName'], ['desc', 'asc', 'asc']);
        room.meeting.attendees = await attendeeMapper.updateAttendeesAsync(room.meeting.attendees, meeting);

        roomRedis.saveRoom(room);
        io.to(roomID).emit('syncMeeting', syncMeeting(user, room, ['attendees'], null));
        fn("OK");
    }
}

/********************************************************************************************/
newMsg = async function(io, user, roomID, msg, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (!_.isNull(room) && (!room.settings.chat || user.type == "organizer" || user.type == "coHost")) {
        msg = {
            user: user.id,
            email: user.email,
            msg: msg,
            datetime: new Date()
        };
        room.chat.push(msg);
        roomRedis.saveRoom(room);
        io.to(roomID).emit('newMsg', msg);
        fn("OK");
    } else {
        fn("FAILED");
    }
}

newQuestion = async function(io, user, roomID, question, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (!_.isNull(room) && (!room.settings.questions || user.type == "organizer" || user.type == "coHost")) {
        question = {
            user: user.id,
            email: user.email,
            question: question,
            datetime: new Date(),
            answers: []
        };
        room.questions.push(question);
        roomRedis.saveRoom(room);
        io.to(roomID).emit('newQuestion', question);
        fn("OK");
    } else {
        fn("FAILED");
    }
}

answerQuestion = async function(io, user, roomID, item, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (user.type == "organizer" || user.type == "coHost") {
        room.questions.map((question, index) => {
            if (item.question.question == question.question && item.question.user == question.user && item.question.datetime == question.datetime) {
                room.questions[index].answers.push({
                    user: user.id,
                    email: user.email,
                    answer: item.answer,
                    datetime: new Date()
                });
            }
        });
        roomRedis.saveRoom(room);
        io.to(roomID).emit('syncMeeting', syncMeeting(user, room, ['questions'], {
            type: 'info',
            msg: 'meeting_answers_updated'
        }));
        fn("OK");
    } else {
        fn("FAILED");
    }
}

/********************************************************************************************/
meetingObjective = async function(io, user, meeting, roomID, objective, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (user.type === "guest" || _.isNull(room)) {
        fn("FAILED");
    } else {
        if (objective.additional) {
            if (_.isUndefined(objective.id)) {
                room.meeting.goals.push(objective);
            } else {
                room.meeting.goals.map((item, index) => {
                    if (item.id === objective.id) {
                        room.meeting.goals[index] = _.clone(objective);
                    }
                });
            }

            room.meeting.goals = _.orderBy(room.meeting.goals, ['priority', 'item'], ['desc', 'asc']);
            room.meeting.goals = await meetingMapper.updateGoalsAsync(room.meeting.goals, meeting);
        } else {
            room.meeting.goals.map((item, index) => {
                if (item.id === objective.id) {
                    room.meeting.goals[index] = objective;
                }
            });
        }

        roomRedis.saveRoom(room);
        io.to(roomID).emit('syncMeeting', syncMeeting(user, room, ['goals'], {
            type: 'info',
            msg: 'meeting_objectives_updated'
        }));

        fn("OK");
    }
}

deleteMeetingObjective = async function(io, user, meeting, roomID, objective, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (user.type === "guest" || _.isNull(room) || !objective.additional || objective.meeting != meeting.id) {
        fn("FAILED");
    } else {
        var tbd = null;
        room.meeting.goals.map((item, index) => {
            if (item.id === objective.id) {
                tbd = index;
            }
        });
        if (!_.isNull(tbd)) {
            room.meeting.goals.splice(tbd, 1);
        }
        await goalModel.deleteOne({ _id: objective.id });

        roomRedis.saveRoom(room);
        io.to(roomID).emit('syncMeeting', syncMeeting(user, room, ['goals'], {
            type: 'info',
            msg: 'meeting_objectives_updated'
        }));

        fn("OK");
    }
}

/********************************************************************************************/
meetingDoc = async function(io, user, meeting, roomID, doc, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (!_.isNull(room) && (!room.settings.docs || user.type == "organizer" || user.type == "coHost")) {
        if (_.isUndefined(doc.created)) {
            doc.created = new Date();
            room.meeting.docs.push(doc);
        } else {
            room.meeting.docs.map((item, index) => {
                if (item.created === doc.created && item.url === doc.url) {
                    room.meeting.docs[index] = _.clone(doc);
                }
            });
        }

        room.meeting.docs = _.orderBy(room.meeting.docs, ['name'], ['asc']);

        roomRedis.saveRoom(room);
        io.to(roomID).emit('syncMeeting', syncMeeting(user, room, ['docs'], {
            type: 'info',
            msg: 'meeting_docs_updated'
        }));

        fn("OK");
    } else {
        fn("failed");
    }
}

deleteMeetingDoc = async function(io, user, meeting, roomID, doc, fn) {
    var room = await roomRedis.getRoom(roomID);
    if (user.type === "guest" || _.isNull(room)) {
        fn("FAILED");
    } else {
        var tbd = null;
        room.meeting.docs.map((item, index) => {
            if (item.created === doc.created && item.url === doc.url) {
                tbd = index;
            }
        });
        if (!_.isNull(tbd)) {
            room.meeting.docs.splice(tbd, 1);
        }

        if (doc.type != "link" && fs.existsSync('./public/docs/' + doc.url)) {
            fs.unlinkSync('./public/docs/' + doc.url);
        }

        roomRedis.saveRoom(room);
        io.to(roomID).emit('syncMeeting', syncMeeting(user, room, ['docs'], {
            type: 'info',
            msg: 'meeting_docs_updated'
        }));

        fn("OK");
    }
}

/********************************************************************************************/
disconnect = async function(io, timeOut, action, socket, meetingCode, user, roomID) {
    console.log('DISCONNECT', {
        'Meeting': meetingCode,
        'User': user.email,
        'SocketID': socket.id,
        'Action': action,
        'Date': new Date()
    });

    if (!_.isNull(timeOut)) {
        clearTimeout(timeOut);
    }

    if (action == "duringMeeting") {
        var room = await roomRedis.getRoom(roomID);
        if (!_.isNull(room)) {
            room.participants.splice(room.participants.indexOf(user.email), 1);
            socket.to(roomID).emit('updateParticipants', { participants: room.participants });
            roomRedis.deleteSocketFromRoom(room, await io.in(roomID).clients(), user.email);

            //TODO: If room.sockets are empty or meeting ended based on datetime/duration and or status 
            //roomRedis.closeRoom(room);
        }
    }
}