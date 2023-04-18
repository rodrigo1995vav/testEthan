var mongoose = require('mongoose');

var projectSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    name: {
        type: String,
        required: true,
        max: 200
    },
    description: {
        type: String,
    },
    reference: {
        type: String,
        max: 100
    },
    type: {
        type: String,
        max: 100
    },
    deleted: {
        type: Number,
        required: true,
        default: 0
    },
    members: {
        type: Array,
        default: []
    },
    board: {
        type: Array,
        default: []
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

module.exports = mongoose.model('project', projectSchema);