var Email = require('email-templates');


var fs = require('fs');
var nodemailer = require("nodemailer");
var communicationModel = require("../models/communicationModel");
var iCal = require('ical-generator');
var moment = require('moment');
var stripHTML = require("string-strip-html");

exports.send = async function(to, tplName, locals) {

    const email = new Email({
        message: {
            from: '"' + process.env.SMTP_SENDER_NAME + '" <' + process.env.SMTP_SENDER_EMAIL + '>'
        },
        send: true,
        transport: {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE,
            auth: {
                user: process.env.SMTP_USERNAME,
                pass: process.env.SMTP_PASSWORD
            }
        }
    });

    await email.send({
        message: {
            from: "no-reply@team-1.co",
            to: to,
            attachments: [{
                filename: 'logo.png',
                path: __dirname + '/../public/images/logo_transparent.png',
                cid: 'logo'
            }],
        },
        template: __dirname + "/../templates/" + tplName,
        locals: locals
    }).then(console.log).catch(console.error);
}

exports.sendMeetingCommunication = async function(body, meeting, type) {

    let transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE,
        auth: {
            user: process.env.SMTP_USERNAME,
            pass: process.env.SMTP_PASSWORD
        }
    });

    communicationModel.find({ meeting: meeting._id }).then(async function(result) {
        if (body.calendar) {
            var ics = iCal({
                domain: 'team-1.co',
                name: 'TEAM-1.CO - Making meetings more efficient',
                timezone: meeting.timezone
            });
            ics.prodId('//TEAM1 LLC//TEAM-1.CO//' + body.language.toUpperCase());
            ics.method(type == "cancel" ? type : "request");
            var event = ics.createEvent({
                start: moment(meeting.datetime),
                end: moment(meeting.datetime).add(meeting.duration, 'minutes'),
                summary: meeting.subject,
                status: type == "cancel" ? "cancelled" : "confirmed",
                uid: meeting.id,
                sequence: result.length + 1,
                organizer: meeting.userInfo[0].firstName + " " + meeting.userInfo[0].lastName + " <" + meeting.userInfo[0].email + ">",
                description: stripHTML(body.content.replace(/<\/li><\/ul>/, "\n\n").replace(/(<p>|<li>|<br\/>|<br \/>)/g, "\n")),
                htmlDescription: body.content,
                location: 'https://team-1.co/meeting/' + meeting.code,
                url: 'https://team-1.co/meeting/' + meeting.code
            });
            meeting.attendees.map(function(t) {
                event.createAttendee({
                    email: t.email,
                    role: t.presence === "required" ? 'REQ-PARTICIPANT' : 'OPT-PARTICIPANT'
                });
            });
        }

        var to = [];
        body.to.map(function(t) {
            to.push(t["value"]);
        });

        var attachments = [{
            filename: 'logo.png',
            path: __dirname + '/../public/images/logo_transparent.png',
            cid: 'logo'
        }];
        if (body.calendar) {
            await ics.save('./public/tmp/' + meeting.id + (result.length + 1) + '.ics', function(err) {});
            attachments.push({
                filename: 'invitation.ics',
                path: __dirname + '/../public/tmp/' + meeting.id + (result.length + 1) + '.ics',
                cid: 'invitation'
            });
        }

        var messageId = null;
        try {
            let info = await transporter.sendMail({
                from: "no-reply@team-1.co",
                replyTo: meeting.userInfo[0].email,
                to: to.join(),
                cc: body.cc.replace(';', ','),
                attachments: attachments,
                subject: body.subject,
                html: body.content + "<hr/><br/><img src='cid:logo' width='256px' />"
            });
            messageId = info.message;
        } catch (err) { console.log(err) };

        var com = new communicationModel();
        com.meeting = meeting._id;
        com.type = type;
        com.to = to.join();
        com.cc = body.cc.replace(';', ',');
        com.subject = body.subject;
        com.content = body.content;
        com.language = body.language;
        com.messageId = messageId;
        com.calendar = body.calendar;
        com.save().then();

        if (body.calendar) {
            fs.unlinkSync(__dirname + '/../public/tmp/' + meeting.id + (result.length + 1) + '.ics');
        }
    });

}

exports.message = async function(email, name, message) {

    let transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE,
        auth: {
            user: process.env.SMTP_USERNAME,
            pass: process.env.SMTP_PASSWORD
        }
    });

    var attachments = [{
        filename: 'logo.png',
        path: __dirname + '/../public/images/logo_transparent.png',
        cid: 'logo'
    }];

    try {
        let info = await transporter.sendMail({
            from: "no-reply@team-1.co",
            replyTo: email,
            attachments: attachments,
            to: 'eharris@team-1.co,support@team-1.co',
            subject: "Message coming from website",
            html: email + "<br/>" + name + "<br/>" + message + "<hr/><br/><img src='cid:logo' width='256px' />"
        });
    } catch (err) { console.log(err) };

}