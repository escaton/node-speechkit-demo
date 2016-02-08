'use strict';
var auth = require('./auth');
var rec = require('node-record-lpcm16');
var got = require('got');
var Promise = require('bluebird');
var parseXml = Promise.promisify(require('xml2js').parseString);
var uuid = require('node-uuid');

var fs = require('fs');
var samplesDir = __dirname + '/samples';
var samples = {};
if (fs.existsSync(samplesDir + '/index.json')) {
    samples = require('./samples/index.json');
}
var sampleIndex = fs.readdirSync(samplesDir).filter(function(file) {
    return ~file.indexOf('sample');
}).length;


console.log('Start recording 3s sample');

var data = new Buffer('');
rec.start({
    threshold: 0.1
})
.on('data', function(chunk) {
    data = Buffer.concat([data, chunk]);
})
.on('end', function() {
    var sampleName = 'sample' + sampleIndex + '.wav';
    fs.writeFileSync(samplesDir + '/' + sampleName, data, 'binary');
    console.log('Sample %s saved', sampleName);
    sampleIndex++;
    got('https://asr.yandex.net/asr_xml', {
        query: {
            key: auth.speechKit,
            uuid: uuid.v4().replace(/-/g,''),
            topic: 'queries',
            lang: 'ru-RU'
        },
        timeout: 10*1000,
        headers: {
            'Content-Type': 'audio/x-pcm;bit=16;rate=16000'
        },
        body: data
    })
    .then(function(res) {
        samples[sampleName] = {
            reqID: res.headers['X-YaRequestId']
        };
        return parseXml(res.body);
    })
    .then(function(data) {
        if (data.recognitionResults.$.success) {
            return data.recognitionResults.variant;
        } else {
            throw new Error('no variants');
        }
    })
    .then(function(data) {
        samples[sampleName].success = data;
        console.log(data);
    })
    .catch(function(err) {
        samples[sampleName].error = err.message;
        console.error('err', err);
    })
    .then(function() {
        fs.writeFileSync(samplesDir + '/index.json', JSON.stringify(samples, null ,2));
    });
});

setTimeout(function() {
    rec.stop();
}, 3000);