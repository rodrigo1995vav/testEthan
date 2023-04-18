var mongoose = require('mongoose');

var companySchema = new mongoose.Schema({
    name: { type: String, required: true, max: 100, index: true },
    address: { type: String, required: true, max: 100 },
    zipCode: { type: String, required: true, max: 10 },
    city: { type: String, required: true, max: 100 },
    province: { type: String, required: true, max: 100 },
    country: { type: String, required: true, max: 2 },
    created: {
        type: Date,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    active: { type: Boolean, max: 1, default: false }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

module.exports = mongoose.model('company', companySchema);