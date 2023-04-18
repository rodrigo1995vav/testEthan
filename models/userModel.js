var mongoose = require('mongoose');
var uniqueValidator = require('mongoose-unique-validator');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');
var _ = require('lodash');

var userSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    firstName: { type: String, required: true, max: 100 },
    lastName: { type: String, required: true, max: 100 },
    email: { type: String, lowercase: true, unique: true, required: true, max: 100, match: [/\S+@\S+\.\S+/, 'is invalid'], index: true },
    phone: { type: String, max: 100 },
    hash: { type: String, required: true },
    salt: { type: String, required: true },
    role: { type: String, required: true, default: "User", max: 100 },
    picture: { type: String, default: "" },
    created: {
        type: Date,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    lastLoginDate: {
        type: Date
    },
    timezone: { type: String, max: 100, default: "UTC" },
    loginAttempts: { type: Number, default: 0 },
    active: { type: Boolean, max: 1, default: false },
    deleted: { type: Boolean, max: 1, default: false },
    linkToken: { type: String, default: false },
    linkTokenExp: { type: Date }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

userSchema.plugin(uniqueValidator, { message: 'is already taken.' });

userSchema.virtual('fullName').get(function() {
    return _.upperFirst(_.toLower(this.lastName)) + ', ' + _.upperFirst(_.toLower(this.firstName));
});

userSchema.virtual('initials').get(function() {
    return _.upperFirst(this.firstName.substr(0, 1)) + _.upperFirst(this.lastName.substr(0, 1));
});

userSchema.virtual('companyInfo', {
    ref: 'company',
    localField: 'company',
    foreignField: '_id'
});

userSchema.methods.setPassword = function(password) {
    this.salt = crypto.randomBytes(16).toString('hex');
    this.hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
};

userSchema.methods.validPassword = function(password) {
    var hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
    return this.hash === hash;
};

userSchema.methods.generateJWT = function() {
    return jwt.sign({
        id: this._id,
        fullName: this.fullName,
        initials: this.initials,
        email: this.email,
        role: this.role
    }, process.env.SECRET, { expiresIn: process.env.TOKEN_LIFE + 'm' });
};

userSchema.methods.generateRefreshJWT = function() {
    return jwt.sign({
        id: this._id,
        username: this.email
    }, process.env.REFRESH_SECRET, { expiresIn: process.env.REFRESH_TOKEN_LIFE + 'm' });
};

userSchema.methods.toAuthJSON = function() {
    return {
        email: this.email,
        token: this.generateJWT(),
        refreshToken: this.generateRefreshJWT(),
        fullName: this.fullName,
        picture: this.picture,
        timezone: this.timezone
    };
};

userSchema.methods.generateLinkToken = function() {
    this.linkToken = crypto.createHash('sha1').update(crypto.randomBytes(60) + this._id + this.email).digest('hex');
    this.linkTokenExp = Date.now();
    this.linkTokenExp.setDate(this.linkTokenExp.getDate() + _.toInteger(process.env.LINK_LIFE));
    return this.linkToken;
}

userSchema.pre('findOne', autoPopulateCompany);
userSchema.pre('find', autoPopulateCompany);

module.exports = mongoose.model('user', userSchema);

function autoPopulateCompany(next) {
    this.populate('companyInfo', ['name', 'address', 'zipCode', 'city', 'province', 'country', 'active']);
    next();
}