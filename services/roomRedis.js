var redis = require('./../config/redis');
var { promisify } = require('util');
var _ = require('lodash');

const redisGetAsync = promisify(redis.get).bind(redis);

exports.getRoom = async(id) => {
    var result = await redisGetAsync(id);
    return _.isNull(result) ? null : JSON.parse(result);
}

exports.createRoom = (meeting) => {
    var room = {
        id: "Room_" + meeting.id,
        meeting: meeting, //Agenda, Attendees, Objectives, Documents
        sockets: [], //SocketID and user attached to it
        participants: [], //email of online participants
        chat: [], //userID, email, msg, dateTime
        questions: [], //userID, email, question, dateTime, answers[userID, email, answer, dateTime]
        whiteboard: [], //ShapeItems
        ideation: [],
        votes: [],
        notes: {},
        project: {
            id: null,
            details: null,
            tasks: [],
            board: {
                columns: []
            },
            members: {}
        },
        settings: {
            "chat": false,
            "questions": false,
            "docs": false,
            "whiteboard": meeting.userInfo[0].email,
            "ideation": meeting.userInfo[0].email,
            "votes": meeting.userInfo[0].email,
            "project": meeting.userInfo[0].email
        }
    }
    exports.saveRoom(room);
}

exports.saveRoom = async(room) => {
    redis.setex(room.id, process.env.MEETING_LIFE * 3600, JSON.stringify(room), function(err, res) {});
}

exports.deleteSocketFromRoom = (room, clients, email) => {
    var tbd = []
    room.sockets.map(function(value, key) {
        if (_.isUndefined(clients.sockets[value.socketID])) {
            tbd.push(key);
        }
        if (value.user.email === email) {
            tbd.push(key);
        }
    });

    tbd.map(function(value) {
        room.sockets.splice(value, 1);
    });

    exports.saveRoom(room);
    return room;
}

exports.closeRoom = (id) => {
    redis.del(id);
}