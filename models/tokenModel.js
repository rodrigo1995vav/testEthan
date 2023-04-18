var mongoose = require('mongoose');

var tokenSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    token: { type: String, required: true },
    refreshToken: { type: String, required: true },
    ip: { type: String, required: true },
    created: {
        type: Date,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    active: { type: Boolean, max: 1, default: true }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});


tokenSchema.virtual('userInfo', {
    ref: 'user',
    localField: 'user',
    foreignField: '_id'
});

tokenSchema.pre('findOne', autoPopulateUser);
tokenSchema.pre('find', autoPopulateUser);

module.exports = mongoose.model('token', tokenSchema);

function autoPopulateUser(next) {
    this.populate('userInfo', ['company', 'firstName', 'lastName', 'email', 'role', 'picture', 'timezone', 'active', 'loginAttempts', 'deleted']);
    next();
}