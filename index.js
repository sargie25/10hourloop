require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const spacesModule = require('./spaces');
const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'processed');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Limit to 100MB
  fileFilter: function(req, file, cb) {
    // Accept audio, video, and gif files
    if (file.mimetype.startsWith('audio/') || 
        file.mimetype.startsWith('video/') || 
        file.mimetype === 'image/gif') {
      cb(null, true);
    } else {
      cb(new Error('Only audio, video, and gif files are allowed'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/processed', express.static(outputDir));

// Routes
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.status(200).json({ 
      message: 'File uploaded successfully',
      file: {
        name: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process', async (req, res) => {
  try {
    const { 
      filePath, 
      outputFormat, 
      duration, 
      crossfade = true, 
      crossfadeDuration = 2.0 
    } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'No file path provided' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fileName = path.basename(filePath, path.extname(filePath));
    const outputFileName = `${fileName}_${duration.hours}h${duration.minutes}m${duration.seconds}s.${outputFormat}`;
    const outputPath = path.join(outputDir, outputFileName);
    
    // Start processing in the background and send back a job ID
    const jobId = Date.now().toString();
    res.status(202).json({ 
      message: 'Processing started',
      jobId,
      status: 'processing'
    });
    
    // Process the file based on type
    await processFile(filePath, outputPath, outputFormat, duration, crossfade, crossfadeDuration, jobId);
    
    // If Digital Ocean Spaces is configured, upload the file
    if (process.env.SPACES_KEY && process.env.SPACES_SECRET) {
      try {
        const spacesUrl = await spacesModule.uploadFile(outputPath, outputFileName);
        console.log(`File uploaded to Spaces: ${spacesUrl}`);
        // Here you could update a database or notify the client that the file is ready
      } catch (error) {
        console.error('Error uploading to Spaces:', error);
      }
    }
    
  } catch (error) {
    console.error('Error in /api/process:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/status/:jobId', (req, res) => {
  // In a real implementation, you would check the status of the job in a database
  // For now, we'll just return a placeholder response
  res.status(200).json({
    jobId: req.params.jobId,
    status: 'processing',
    progress: Math.random() * 100 // Random progress for demo
  });
});

app.get('/api/download/:fileName', (req, res) => {
  const filePath = path.join(outputDir, req.params.fileName);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  res.download(filePath);
});

// Helper functions
async function processFile(inputPath, outputPath, outputFormat, duration, crossfade, crossfadeDuration, jobId) {
  try {
    // Calculate total seconds
    const totalSeconds = (duration.hours * 3600) + (duration.minutes * 60) + duration.seconds;
    
    // Determine file type
    const mimetype = execSync(`file --mime-type -b "${inputPath}"`).toString().trim();
    const isAudio = mimetype.startsWith('audio/');
    const isGif = mimetype === 'image/gif';
    
    let ffmpegCommand = '';
    
    if (isAudio) {
      // Process audio file
      if (crossfade) {
        ffmpegCommand = `ffmpeg -i "${inputPath}" -filter_complex "[0:a]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri,atrim=0:${totalSeconds}[aout]" -map "[aout]" -y "${outputPath}"`;
      } else {
        ffmpegCommand = `ffmpeg -stream_loop -1 -i "${inputPath}" -t ${totalSeconds} -c copy -y "${outputPath}"`;
      }
    } else if (isGif) {
      // Process GIF file
      ffmpegCommand = `ffmpeg -stream_loop -1 -i "${inputPath}" -t ${totalSeconds} -y "${outputPath}"`;
    } else {
      // Process video file
      if (outputFormat === 'gif') {
        ffmpegCommand = `ffmpeg -i "${inputPath}" -vf "fps=10,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 -y "${outputPath}"`;
      } else if (crossfade) {
        ffmpegCommand = `ffmpeg -i "${inputPath}" -filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=${crossfadeDuration}[v1];[v1]xfade=duration=${crossfadeDuration}:offset=${totalSeconds-crossfadeDuration}:transition=fade[vout];[0:a]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri,atrim=0:${totalSeconds}[aout]" -map "[vout]" -map "[aout]" -t ${totalSeconds} -y "${outputPath}"`;
      } else {
        ffmpegCommand = `ffmpeg -stream_loop -1 -i "${inputPath}" -t ${totalSeconds} -c copy -y "${outputPath}"`;
      }
    }
    
    // Execute FFmpeg command
    console.log(`Executing command: ${ffmpegCommand}`);
    execSync(ffmpegCommand);
    
    console.log(`Processing complete: ${outputPath}`);
    
    // In a real implementation, you would update the job status in a database
    return outputPath;
  } catch (error) {
    console.error('Processing error:', error.message);
    // In a real implementation, you would update the job status to 'error'
    throw error;
  }
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});