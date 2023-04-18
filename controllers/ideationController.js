var _ = require('lodash');

var ideationModel = require("../models/ideationModel");

/* POST - Insert a new ideation */
exports.insert = async function(req, res) {
    var currentUser = req.payload.userInfo;

    var ideation = new ideationModel();
    _.forEach(req.body, function(value, key) {
        if (_.indexOf(['name', 'items'], key) >= 0)
            ideation[key] = value;
    });
    ideation.user = currentUser._id;

    ideation.save().then(function(ideation) {
        return res.status(200).json({ message: "Ideation saved successful" });
    }).catch(function(err) {
        return res.status(401).json({ errors: { ideation: "Unable to process the request" } });
    });
};

/* GET - View ideation details */
exports.view = function(req, res) {
    var currentUser = req.payload.userInfo;

    if (_.isUndefined(req.params.id)) {
        return res.status(401).json({ errors: { ideation: "ideation doesn't exist" } });
    }

    ideationModel.findById(req.params.id)
        .then(function(ideation) {
            return _.toString(currentUser.id) === _.toString(ideation.user) ? res.status(200).json({ ideation: ideation.toJSON() }) : res.status(401).json({ errors: { user: "User is unauthorized" } });
        }).catch(function(err) {
            return res.status(401).json({ errors: { ideation: "ideation doesn't exist" } });
        });
};

/* PUT - Update ideation */
exports.update = function(req, res) {
    var currentUser = req.payload.userInfo;

    if (_.isUndefined(req.params.id)) {
        return res.status(401).json({ errors: { ideation: "Ideation id required" } });
    }

    ideationModel.findById(req.params.id)
        .then(async function(ideation) {
            if (_.toString(currentUser.id) === _.toString(ideation.user)) {
                ideation['items'] = req.body['items'];
                ideation["lastUpdated"] = Date.now();

                await ideationModel.findByIdAndUpdate({ _id: ideation.id }, ideation, { new: true });
                return res.status(200).json({ message: "Ideation updated successfully" });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            res.status(401).json({ errors: { ideation: "Ideation doesn't exist" } });
        });
};

/* DELETE - Delete ideation */
exports.delete = function(req, res) {
    var currentUser = req.payload.userInfo;

    if (_.isUndefined(req.params.id)) {
        return res.status(401).json({ errors: { ideation: "Ideation doesn't exist" } });
    }

    ideationModel.findById(req.params.id).select()
        .then(async function(ideation) {
            if (_.toString(currentUser.id) === _.toString(ideation.user)) {
                await ideationModel.deleteOne({ _id: ideation.id });
                return res.status(200).json({ message: "Ideation deleted successfully" });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            res.status(401).json({ errors: { ideation: "Ideation doesn't exist" } });
        });
};

/* POST - List of ideation */
exports.index = async function(req, res) {
    var currentUser = req.payload.userInfo;

    try {
        var ideations = await ideationModel.find({ user: currentUser._id })
            .sort([
                ["title", "asc"]
            ]);
    } catch (err) { console.log(err) }

    return res.status(200).json({ ideations: ideations });
};