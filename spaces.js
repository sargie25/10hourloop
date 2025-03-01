const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure the AWS SDK with DO Spaces
const spacesEndpoint = new AWS.Endpoint(process.env.SPACES_REGION + '.digitaloceanspaces.com');
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.SPACES_KEY,
  secretAccessKey: process.env.SPACES_SECRET
});

const BUCKET_NAME = process.env.SPACES_BUCKET;

// Upload a file to Spaces
exports.uploadFile = async (localFilePath, fileName) => {
  const fileContent = fs.readFileSync(localFilePath);
  
  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: fileContent,
    ACL: 'public-read',
    ContentType: path.extname(fileName) === '.mp3' ? 'audio/mpeg' : 
                path.extname(fileName) === '.mp4' ? 'video/mp4' : 
                path.extname(fileName) === '.gif' ? 'image/gif' : 'application/octet-stream'
  };
  
  try {
    const data = await s3.upload(params).promise();
    return data.Location; // Public URL of the file
  } catch (error) {
    console.error('Error uploading file to Spaces:', error);
    throw error;
  }
};

// Delete a file from Spaces
exports.deleteFile = async (fileName) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName
  };
  
  try {
    await s3.deleteObject(params).promise();
    console.log(`File deleted: ${fileName}`);
    return true;
  } catch (error) {
    console.error('Error deleting file from Spaces:', error);
    throw error;
  }
};

// Get a signed URL for temporary access
exports.getSignedUrl = (fileName, expirySeconds = 3600) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Expires: expirySeconds
  };
  
  return s3.getSignedUrl('getObject', params);
};

// Check if a file exists
exports.fileExists = async (fileName) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName
  };
  
  try {
    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    if (error.code === 'NotFound') {
      return false;
    }
    throw error;
  }
};