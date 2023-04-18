var mongoose = require('mongoose');

var attendeeSchema = new mongoose.Schema({
    meeting: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meeting',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fullName: {
        type: String,
        required: true,
        max: 100
    },
    email: {
        type: String,
        lowercase: true,
        required: true,
        max: 100,
        match: [/\S+@\S+\.\S+/, 'is invalid'],
        index: true
    },
    presence: {
        type: String,
        max: 20,
        default: "optional"
    },
    type: {
        type: String,
        required: true,
        default: "guest"
    },
    order: {
        type: Number,
        required: true
    },
    created: {
        type: Date,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

attendeeSchema.virtual('userInfo', {
    ref: 'user',
    localField: 'user',
    foreignField: '_id'
});

attendeeSchema.pre('findOne', autoPopulate);
attendeeSchema.pre('find', autoPopulate);

module.exports = mongoose.model('attendee', attendeeSchema);

function autoPopulate(next) {
    this.populate('userInfo', ['firstName', 'lastName', 'picture']);
    next();
}