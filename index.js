var express = require('express'), app = express();
const bodyParser = require('body-parser');
var cors = require('cors');
const port = process.env.PORT || 3002;
var path = require('path');
var useragent = require('express-useragent');
const ytdl = require('ytdl-core')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const { PassThrough } = require('stream')
const fs = require('fs')

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(useragent.express());

function sec2time(timeInSeconds) {
	var pad = function (num, size) { return ('000' + num).slice(size * -1); },
		time = parseFloat(timeInSeconds).toFixed(3),
		hours = Math.floor(time / 60 / 60),
		minutes = Math.floor(time / 60) % 60,
		seconds = Math.floor(time - minutes * 60),
		milliseconds = time.slice(-3);
	// return pad(hours, 2) + ':' + pad(minutes, 2) + ':' + pad(seconds, 2) + ',' + pad(milliseconds, 3);
	return pad(hours, 2) + ':' + pad(minutes, 2) + ':' + pad(seconds, 2);
}
function convert(input, output, callback) {
	ffmpeg(input).output(output).on('end', function () {
		console.log('conversion ended');
		callback(null);
	}).on('error', function (err) {
		console.log('error: ', err.code, err.msg);
		callback(err);
	}).run();
}

app.get('/user_agent', function (req, res) {
	var ua = req.useragent;
	res.send({ browser: ua.browser, version: ua.version, os: ua.os, platform: ua.platform, source: ua.source });
});
app.get('/audio/:v', function (req, res) {
	var vid = req.params.v;
	if (vid != '') {
		// var youtubeStream = require('youtube-audio-stream');
		var requestUrl = 'http://youtube.com/watch?v=' + vid;
		try {
			// youtubeStream(requestUrl).pipe(res);
			var opt = {
				...opt,
				videoFormat: 'mp4',
				quality: 'lowest',
				audioFormat: 'mp3',
				filter(format) { return format.container === opt.videoFormat && format.audioBitrate }
			}
			const video = ytdl(requestUrl, opt)
			const { file, audioFormat } = opt
			const stream = file ? fs.createWriteStream(file) : new PassThrough()
			const ffmpeg_ = new ffmpeg(video)

			process.nextTick(() => {
				const output = ffmpeg_.format(audioFormat).pipe(stream).pipe(res);
				ffmpeg_.on('error', error => stream.emit('error', error));
				output.on('error', error => {
					video.end()
					stream.emit('error', error)
				});
				output.on('finish', (src) => {
					console.log('Something is piping into the writer.');
				});
			});
			// stream.pipe(res);
			// stream.unpipe(res);
		} catch (exception) {
			res.status(500).send(exception);
		}
	} else { res.send({}); }
});
app.get('/player', function (req, res) {
	// var vid = req.params.v;
	// if (vid != '') {
	// var requestUrl = 'http://youtube.com/watch?v=' + vid;
	res.sendFile(path.join(__dirname + '/player.html'));
	// } else { res.send({}); }
});
app.get('/video', function (req, res) {
	// var vid = req.params.v;
	// if (vid != '') {
	// var requestUrl = 'http://youtube.com/watch?v=' + vid;
	// res.sendFile(path.join(__dirname + '/player.html'));
	// } else { res.send({}); }
	var stream = new PassThrough();
	var ffmpeg = new FFmpeg('public/a.mp4');
	ffmpeg.format('webm').size('480x360').fps(24).videoCodec('libvpx').pipe(stream);
	stream.ffmpeg = ffmpeg;
	stream.pipe(res);
});
app.get('/:v', async function (req, res) {
	var vid = req.params.v;
	if (vid != '') {
		try {
			var info = await ytdl.getBasicInfo(vid);
			info = info.videoDetails;
			// console.log(info);
			res.send({
				title: info.title, author: info.author, duration: sec2time(info.lengthSeconds),
				thumbnail: info.thumbnail.thumbnails,
				stream: { audio: req.protocol + '://' + req.get('host') + '/audio/' + vid, video: null }
			});
		} catch (e) { res.send({}); }
	} else { res.send({}); }
});
app.all('/', async function (req, res) { res.send({}); });

app.enable('trust proxy');
app.listen(port);