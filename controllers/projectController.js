var _ = require('lodash');

var projectModel = require('../models/projectModel');

/* POST - Insert a new project */
exports.insert = async function(req, res) {
    var currentUser = req.payload.userInfo;

    var project = new projectModel();
    _.forEach(req.body, function(value, key) {
        if (_.indexOf(['name', 'description', 'reference', 'type', 'members', 'board'], key) >= 0)
            project[key] = value;
    });
    project.company = currentUser.company;

    project.save().then(function(project) {
        return res.status(200).json({ message: "Project saved successfully" });
    }).catch(function(err) {
        return res.status(401).json({ errors: { project: "Unable to process the request" } });
    });
};

/* GET - View user details */
exports.view = function(req, res) {
    var currentUser = req.payload.userInfo;

    if (_.isUndefined(req.params.id)) {
        return res.status(401).json({ errors: { project: "project doesn't exist" } });
    }

    projectModel.findById(req.params.id)
        .then(function(project) {
            if (currentUser.role == "Admin" ||
                (currentUser.role == "Superuser" && _.toString(currentUser.company) === _.toString(project.company))
            ) {
                return _.toString(currentUser.company) === _.toString(project.company) ? res.status(200).json({ project: project.toJSON() }) : res.status(401).json({ errors: { user: "User is unauthorized" } });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            return res.status(401).json({ errors: { project: "Project doesn't exist" } });
        });
};

/* PUT - Update project information */
exports.update = function(req, res) {
    var currentUser = req.payload.userInfo;

    if (_.isUndefined(req.params.id)) {
        return res.status(401).json({ errors: { project: "project doesn't exist" } });
    }
    projectModel.findById(req.params.id).select()
        .then(function(project) {
            if (currentUser.role == "Admin" ||
                (currentUser.role == "Superuser" && _.toString(currentUser.company) == _.toString(project.company))
            ) {
                var project = {};
                project.id = req.params.id;
                _.forEach(req.body, function(value, key) {
                    if (_.indexOf(['name', 'description', 'reference', 'type', 'members', 'board'], key) >= 0) {
                        project[key] = value;
                    }
                });
                project.lastUpdated = Date.now();
                projectModel.findByIdAndUpdate({ _id: project.id }, project, { new: true }, function(err, result) {
                    return res.status(200).json({ message: "Project updated successfully" });
                });
            } else {
                return res.status(401).json({ errors: { project: "Project is unauthorized" } });
            }
        }).catch(function(err) {
            res.status(401).json({ errors: { project: "Project doesn't exist" } });
        });
};

/* DELETE - Delete project */
exports.delete = function(req, res) {
    var currentUser = req.payload.userInfo;

    if (_.isUndefined(req.params.id)) {
        return res.status(401).json({ errors: { project: "project doesn't exist" } });
    }

    projectModel.findById(req.params.id).select()
        .then(function(project) {
            if (currentUser.role == "Admin" ||
                (currentUser.role == "Superuser" && _.toString(currentUser.company) == _.toString(project.company))
            ) {
                projectModel.findByIdAndUpdate({ _id: project._id }, { "deleted": true, "lastUpdated": Date.now() }, { new: true }, function(err, result) {
                    return res.status(200).json({ message: "Project deleted successfully" });
                });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            res.status(401).json({ errors: { project: "Project doesn't exist" } });
        });
};

/* POST - List all the projects where I am a member */
exports.member = function(req, res) {
    var currentUser = req.payload.userInfo;

    projectModel.find({
            $and: [
                { company: currentUser.company },
                { deleted: false },
                { 'members.user': currentUser.id }
            ]
        })
        .sort([
            ['name', 'asc']
        ])
        .exec(function(err, projects) {
            res.status(200).json({ projects: projects });
        });
};

/* POST - List all the projects within my company */
exports.index = function(req, res) {
    var currentUser = req.payload.userInfo;

    projectModel.find({
            $and: [
                { company: currentUser.company },
                { deleted: false }
            ]
        })
        .sort([
            ['created', 'desc']
        ])
        .exec(function(err, projects) {
            res.status(200).json({ projects: projects });
        });
};