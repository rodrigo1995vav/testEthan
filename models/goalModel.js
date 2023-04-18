var mongoose = require('mongoose');

var goalSchema = new mongoose.Schema({
    meeting: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meeting',
        required: true
    },
    item: {
        type: String,
        required: true,
        max: 200
    },
    priority: {
        type: String,
        required: true,
        default: "low"
    },
    order: {
        type: Number,
        required: true
    },
    additional: {
        type: Boolean,
        default: false
    },
    completed: {
        type: Number,
        default: 0
    },
    created: {
        type: Date,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

module.exports = mongoose.model('goal', goalSchema);