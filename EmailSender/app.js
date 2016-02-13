console.log('Loading function');

exports.handler = function (event, context) {
    console.log('function started');
    var Promise = require("bluebird");
    var config = require('nconf');
    var AWS = require('aws-sdk');
    var Bliss = require('bliss');
    var fs = require('fs');
    
    config.file('config.json');
    
    var ses = Promise.promisifyAll(new AWS.SES({ region: config.get('aws:region') }));
    var s3 = Promise.promisifyAll(new AWS.S3({ region: config.get('aws:region') }));
    var bliss = new Bliss();
    
    var params = {
        Bucket: config.get('mail:data:bucket'),
        Key: config.get('mail:data:key'),
    };
    
    s3.getObjectAsync(params).then(function (data) {
        var content = data.Body.toString().replace(/^\uFEFF/, '');//remove BOM
        var members = JSON.parse(content);
        return Promise.map(members, function (member) {
            var body = bliss.render(config.get('mail:template-body'), member);
            var params = {
                Destination: { ToAddresses: [member.email] },
                Message: {
                    Body: { Html: { Data: body, Charset: 'UTF-8' } },
                    Subject: { Data: config.get('mail:subject'), Charset: 'UTF-8' }
                },
                Source: config.get('mail:from'),
                ReplyToAddresses: [config.get('mail:from')]
            };
            return ses.sendEmailAsync(params);
        })
    .then(function () {
            context.succeed('mails sent!');
        });
    })
    .catch(function (e) {
        console.error("error while sending mail :", e);
        context.fail(e);
    });
}