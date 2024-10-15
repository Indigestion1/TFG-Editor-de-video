const ffmpeg = require('fluent-ffmpeg');

class VideoEditor {
	static trimVideo(inputPath, outputPath, startTime, duration) {
		return new Promise((resolve, reject) => {
			ffmpeg(inputPath)
				.setStartTime(startTime)
				.setDuration(duration)
				.output(outputPath)
				.on('end', () => resolve(outputPath))
				.on('error', (err) => reject(err))
				.run();
		});
	}
}

module.exports = VideoEditor;