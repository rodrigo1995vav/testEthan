var mongoose = require('mongoose');

var communicationSchema = new mongoose.Schema({
    meeting: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meeting',
        required: true
    },
    type: {
        type: String,
        max: 20
    },
    to: {
        type: String,
        required: true,
        max: 1000
    },
    cc: {
        type: String,
        max: 1000
    },
    subject: {
        type: String,
        required: true,
        max: 100
    },
    content: {
        type: String,
        required: true,
        max: 1000
    },
    language: {
        type: String,
        max: 2,
        default: "en"
    },
    calendar: {
        type: String,
        max: 20,
    },
    messageId: {
        type: String,
        max: 200
    },
    created: {
        type: Date,
        default: Date.now
    },
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});


module.exports = mongoose.model('communication', communicationSchema);