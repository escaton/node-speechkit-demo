'use strict';
var auth = require('./auth');
var rec = require('node-record-lpcm16');
var net = require('net');
var Promise = require('bluebird');
var uuid = require('node-uuid');
var bsplit = require('buffer-split');

var ProtoBuf = require("protobufjs");
var ByteBuffer = ProtoBuf.ByteBuffer;
var Protobuf = ProtoBuf.loadProtoFile({
    root: __dirname + '/protobuf',
    file: 'voiceproxy.proto'
}).build();

var STATE = {
    inited: false,
    ready: false,
    _queue: 0,
    _lastChunkCb: function() {},
    queue: function(delta) {
        this._queue+=delta;
        if (this._queue === 0) {
            this._lastChunkCb();
        } 
    },
    waitForLastChunk: function(cb) {
        this._lastChunkCb = cb;
    }
};

function sendMessage(msg, socket) {
    var payload = msg.toBuffer();
    var buffer = Buffer.concat([
        new Buffer(payload.length.toString(16)),
        new Buffer('\r\n'),
        payload
    ]);
    return socket.write(buffer);
}

function init(socket) {
    var msg = new Protobuf.VoiceProxyProtobuf.ConnectionRequest({
        speechkitVersion: '1',
        serviceName: 'asr_dictation',
        uuid: uuid.v4().replace(/-/g,''),
        apiKey: auth.speechKit,
        applicationName: 'escaton-test',
        device: 'desktop',
        coords: '0, 0',
        topic: 'freeform',
        lang: 'ru-RU',
        format: 'audio/x-pcm;bit=16;rate=16000',
        punctuation: true,
        // advancedASROptions: {
        //     // utterance_silence: 120,
        //     // cmn_latency: 150
        // }
    });
    sendMessage(msg, socket);

    var recStream = rec.start({
        threshold: 0.01
    })
    .on('readable', function() {
        var chunk;
        while (null !== (chunk = recStream.read(32768))) {
            var msg = new Protobuf.VoiceProxyProtobuf.AddData({
                audioData: chunk,
                lastChunk: false
            });
            STATE.queue(1);
            sendMessage(msg, socket);
        }
    })
    .on('end', function() {
        STATE.waitForLastChunk(function() {
            socket.end();
        });
    });
}

var client = new net.Socket();
client.connect(80, 'voice-stream.voicetech.yandex.net', function() {

    console.log('connected');
    client.write([
        'GET /asr_partial HTTP/1.1\r\n',
        'User-Agent:KeepAliveClient\r\n',
        'Host: voice-stream.voicetech.yandex.net:80\r\n',
        'Upgrade: dictation\r\n\r\n',
    ].join(''));

});

client.on('data', function(data) {
    if (STATE.inited) {
        var delim = new Buffer('\r\n');
        var parts = bsplit(data, delim);
        if (STATE.ready) {
            try {
                var data = Protobuf.VoiceProxyProtobuf.AddDataResponse.decode(parts[1]);
                STATE.queue(-data.messagesCount);
                if (data.responseCode === 200 && data.recognition[0]) {
                    console.log("\u001b[2J\u001b[0;0H" + data.recognition[0].normalized)
                }
            } catch (e) {
                var data = Protobuf.BasicProtobuf.ConnectionResponse.decode(parts[1]);
                console.error(data);
            }
        } else {
            var data = Protobuf.BasicProtobuf.ConnectionResponse.decode(parts[1]);
            STATE.ready = true;
        }
    } else {
        init(client);
        STATE.inited = true;
    }
});

client.on('close', function() {
    console.log('Connection closed');
});