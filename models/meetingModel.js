var mongoose = require('mongoose');
var uniqueValidator = require('mongoose-unique-validator');
const { ceil } = require('lodash');

var meetingSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true,
        max: 100
    },
    type: {
        type: String,
        max: 100
    },
    reference: {
        type: String,
        max: 100
    },
    description: {
        type: String,
        max: 400
    },
    code: {
        type: String,
        unique: true,
        index: true
    },
    secure: {
        type: Boolean,
        default: false
    },
    password: {
        type: String,
        max: 10
    },
    datetime: {
        type: Date,
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    notes: {
        type: String,
        max: 1000
    },
    status: { //new - started - completed - cancelled
        type: String,
        max: 50,
        default: "new"
    },
    created: {
        type: Date,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    agenda: {
        type: Array,
        default: []
    },
    docs: {
        type: Array,
        default: []
    },
    room: {
        type: Object,
        default: {}
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

meetingSchema.plugin(uniqueValidator, { message: 'is already taken.' });

meetingSchema.virtual('timeLeft').get(function() {
    return ceil((new Date(this.datetime) - new Date()) / 60000);
});


meetingSchema.virtual('companyInfo', {
    ref: 'company',
    localField: 'company',
    foreignField: '_id'
});

meetingSchema.virtual('userInfo', {
    ref: 'user',
    localField: 'user',
    foreignField: '_id'
});


meetingSchema.virtual('attendees', {
    ref: 'attendee',
    localField: '_id',
    foreignField: 'meeting',
    options: {
        sort: { order: 'asc' }
    }
});

meetingSchema.virtual('goals', {
    ref: 'goal',
    localField: '_id',
    foreignField: 'meeting',
    options: {
        sort: { order: 'asc' }
    }
});

meetingSchema.virtual('communications', {
    ref: 'communication',
    localField: '_id',
    foreignField: 'meeting',
    options: {
        sort: { created: 'desc' }
    }
});

meetingSchema.pre('findOne', autoPopulate);
meetingSchema.pre('find', autoPopulate);

module.exports = mongoose.model('meeting', meetingSchema);

function autoPopulate(next) {
    this.populate('companyInfo', ['name', 'active']);
    this.populate('userInfo', ['firstName', 'lastName', 'email', 'active', 'deleted', 'timezone', 'picture']);
    this.populate('attendees');
    this.populate('goals');
    this.populate('communications');
    next();
}