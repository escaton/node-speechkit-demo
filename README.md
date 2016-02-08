#Node speechkit demo
Simple implementation of yandex [speeckit cloud]
(https://tech.yandex.ru/speechkit/cloud/doc/dg/concepts/speechkit-dg-recogn-docpage/)

##Usage:
 * `npm i`
 * create `auth.js` with `exports.speecKit = 'xxx-your-key-xxx';`
 * on osx and Linux check for `rec` util from `sox` package
 
###Samples
`node samples.js` will record 3s sample, recognize it and write to `samples` folder with result in `samples/index.json`
###Stream
`node stream.js` will start listen to you, stream data to speech cloud and recieve recognition
