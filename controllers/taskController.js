var _ = require('lodash');
var fs = require('fs');
var crypto = require('crypto');

var projectModel = require('../models/projectModel');
var taskModel = require('../models/taskModel');

/* POST - Upload a document */
exports.upload = function(req, res) {
    if (req.file) {
        var allowedExtensions = ['.txt', '.csv', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'];
        var allowedTypes = [
            'text/plain', //.txt
            'text/csv', //.csv
            'application/pdf', //.pdf
            'application/msword', //.doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', //.docx
            'application/vnd.ms-excel', //.xls
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', //.xslx
            'application/vnd.ms-powerpoint', //.ppt
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', //.pptx
            'application/vnd.oasis.opendocument.text', //.odt
            'application/vnd.oasis.opendocument.spreadsheet', //.ods
            'application/vnd.oasis.opendocument.presentation' //.odp
        ];

        if (allowedTypes.indexOf(req.file.mimetype)) {
            var ext = allowedExtensions[allowedTypes.indexOf(req.file.mimetype)];
            if (req.file.size < parseInt(process.env.FILE_MAX_SIZE) * 1000 * 1000) {
                fs.renameSync(req.file.path, req.file.path + ext);
                return res.status(200).json({ file: req.file.filename + ext });
            } else {
                return res.status(401).json({ errors: { file: "Docs.errors.file_too_large" } });
            }
        } else {
            return res.status(401).json({ errors: { file: "Docs.errors.file_type" } });
        }
    } else {
        return res.status(401).json({ errors: { file: "Not authorized" } });
    }
};

/* POST - Insert a new task */
exports.insert = async function(req, res) {
    var currentUser = req.payload.userInfo;

    if (_.isUndefined(req.params.project)) {
        return res.status(401).json({ errors: { project: "project doesn't exist" } });
    }

    projectModel.findById(req.params.project)
        .then(async function(project) {
            var member = false;
            project.members.map((item) => {
                if (item.user === currentUser.id) {
                    member = true;
                }
            });

            if (member) {
                var task = new taskModel();
                _.forEach(req.body, function(value, key) {
                    if (_.indexOf(['title', 'description', 'priority', 'status', 'board', 'type', 'progress', 'dueDate', 'assignedTo', 'comments'], key) >= 0)
                        task[key] = value;
                });
                task.createdBy = currentUser.id;
                task.project = project.id;
                task.number = (await taskModel.find({ project: project.id })).length + 1;
                req.body.docs.map((doc, i) => {
                    var newURL = (doc.type == "link") ? doc.url : crypto.createHash('sha1').update(crypto.randomBytes(20)).digest('hex') + doc.url;
                    doc.created = new Date();
                    if (doc.type != "link") {
                        fs.renameSync('./public/tmp/' + doc.url, './public/docs/' + newURL);
                    }
                    doc.url = newURL;
                    task.docs.push(doc);
                });
                task.save().then(function(task) {
                    return res.status(200).json({ message: "Task saved successfully" });
                }).catch(function(err) {
                    return res.status(401).json({ errors: { task: "Unable to process the request" } });
                });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            return res.status(401).json({ errors: { project: "Project doesn't exist" } });
        });
};

/* GET - View task details */ //TODO
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

/* PUT - Update task information */
exports.update = function(req, res) {
    var currentUser = req.payload.userInfo;

    if (_.isUndefined(req.params.project)) {
        return res.status(401).json({ errors: { project: "project doesn't exist" } });
    }

    if (_.isUndefined(req.params.id)) {
        return res.status(401).json({ errors: { task: "Task doesn't exist" } });
    }

    projectModel.findById(req.params.project)
        .then(function(project) {
            var member = false;
            project.members.map((item) => {
                if (item.user === currentUser.id) {
                    member = true;
                }
            });
            if (member) {
                taskModel.findById(req.params.id)
                    .then(function(task) {
                        if (_.toString(task.project) === _.toString(project.id)) {
                            var tbd = task.docs;
                            var task = {};
                            task.id = req.params.id;
                            _.forEach(req.body, function(value, key) {
                                if (_.indexOf(['title', 'description', 'priority', 'status', 'board', 'type', 'progress', 'dueDate', 'assignedTo', 'comments'], key) >= 0) {
                                    task[key] = value;
                                }
                            });
                            task.lastUpdated = Date.now();
                            task.docs = [];
                            req.body.docs.map((doc, i) => {
                                if (_.isUndefined(doc.created)) {
                                    var newURL = (doc.type == "link") ? doc.url : crypto.createHash('sha1').update(crypto.randomBytes(20)).digest('hex') + doc.url;
                                    doc.created = new Date();
                                    if (doc.type != "link") {
                                        fs.renameSync('./public/tmp/' + doc.url, './public/docs/' + newURL);
                                    }
                                    doc.url = newURL;
                                } else {
                                    var del = null;
                                    for (var i = 0; i < tbd.length; i++) {
                                        if (tbd[i].url === doc.url) {
                                            del = i;
                                        }
                                    }
                                    tbd.splice(del, 1);
                                }
                                task.docs.push(doc);
                            });
                            tbd.map((d) => {
                                if (d.type !== "link") {
                                    fs.unlinkSync('./public/docs/' + d.url);
                                }
                            });
                            taskModel.findByIdAndUpdate({ _id: task.id }, task, { new: true }, function(err, result) {
                                return res.status(200).json({ message: "Task updated successfully" });
                            });
                        } else {
                            return res.status(401).json({ errors: { user: "User is unauthorized" } });
                        }
                    }).catch(function(err) {
                        console.log(err);
                        return res.status(401).json({ errors: { task: "Task doesn't exist" } });
                    });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            console.log(err);
            return res.status(401).json({ errors: { project: "Project doesn't exist" } });
        });
};

/* DELETE - Delete task */
exports.delete = function(req, res) {
    var currentUser = req.payload.userInfo;

    if (_.isUndefined(req.params.project)) {
        return res.status(401).json({ errors: { project: "project doesn't exist" } });
    }

    if (_.isUndefined(req.params.id)) {
        return res.status(401).json({ errors: { task: "task doesn't exist" } });
    }

    projectModel.findById(req.params.project).select()
        .then(function(project) {
            var member = false;
            project.members.map((item) => {
                if (item.user === currentUser.id) {
                    member = true;
                }
            })
            if (member) {
                taskModel.findById(req.params.id)
                    .then(function(task) {
                        if (_.toString(task.project) === _.toString(project.id)) {
                            taskModel.findByIdAndUpdate({ _id: task._id }, { "deleted": true, "lastUpdated": Date.now() }, { new: true }, function(err, result) {
                                return res.status(200).json({ message: "Task deleted successfully" });
                            });
                        } else {
                            return res.status(401).json({ errors: { user: "User is unauthorized" } });
                        }
                    }).catch(function(err) {
                        return res.status(401).json({ errors: { task: "Task doesn't exist" } });
                    });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            res.status(401).json({ errors: { project: "Project doesn't exist" } });
        });
};

/* POST - List all the tasks within a project */
exports.index = function(req, res) {
    var currentUser = req.payload.userInfo;

    if (_.isUndefined(req.params.project)) {
        return res.status(401).json({ errors: { project: "project doesn't exist" } });
    }

    projectModel.findById(req.params.project)
        .then(function(project) {
            var member = false;
            project.members.map((item) => {
                if (item.user === currentUser.id) {
                    member = true;
                }
            })
            if (member) {
                taskModel.find({
                        $and: [
                            { project: req.params.project },
                            { deleted: false }
                        ]
                    })
                    .sort([
                        ['priority', 'desc'],
                        ['type', 'asc']
                    ])
                    .exec(function(err, tasks) {
                        res.status(200).json({ tasks: tasks });
                    });
            } else {
                return res.status(401).json({ errors: { user: "User is unauthorized" } });
            }
        }).catch(function(err) {
            return res.status(401).json({ errors: { project: "Project doesn't exist" } });
        });
};