var mongoose = require('mongoose');

var taskSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    number: {
        type: Number,
        required: true,
    },
    title: {
        type: String,
        required: true,
        max: 200
    },
    description: {
        type: String,
    },
    priority: {
        type: String,
        required: true,
        default: 'p1'
    },
    status: {
        type: String,
    },
    board: {
        type: String,
    },
    type: {
        type: String,
    },
    progress: {
        type: Number,
        required: true,
        default: 0
    },
    dueDate: {
        type: Date
    },
    comments: {
        type: Array,
        default: []
    },
    docs: {
        type: Array,
        default: []
    },
    deleted: {
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

taskSchema.pre('findOne', autoPopulateProject);
taskSchema.pre('find', autoPopulateProject);

module.exports = mongoose.model('task', taskSchema);

function autoPopulateProject(next) {
    this.populate('projectInfo');
    next();
}