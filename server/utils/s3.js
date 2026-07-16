const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const bucketName = process.env.AWS_S3_BUCKET_NAME;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const isS3Configured = !!(bucketName && region && accessKeyId && secretAccessKey);

let s3Client = null;
if (isS3Configured) {
  s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
  console.log('✅ S3 Client initialized in AWS Mode.');
} else {
  console.warn('⚠️ S3 environment variables missing in .env. Running S3 in LOCAL FALLBACK mode.');
  // Ensure the local uploads directory exists
  const localUploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(localUploadDir)) {
    fs.mkdirSync(localUploadDir, { recursive: true });
  }
}

/**
 * Uploads a file buffer to S3 (or local disk in fallback mode)
 * @param {Buffer} fileBuffer 
 * @param {string} originalName 
 * @param {string} mimeType 
 * @returns {Promise<string>} The S3 Key (or local filename)
 */
const uploadToS3 = async (fileBuffer, originalName, mimeType) => {
  const fileExtension = path.extname(originalName);
  const uniqueKey = `documents/${Date.now()}-${uuidv4()}${fileExtension}`;

  if (isS3Configured) {
    const uploadParams = {
      Bucket: bucketName,
      Key: uniqueKey,
      Body: fileBuffer,
      ContentType: mimeType,
      // Strict Server-Side Encryption at-rest using S3 managed keys (AES256) - FREE tier compliant
      ServerSideEncryption: 'AES256'
    };

    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);
    return uniqueKey;
  } else {
    // Local Fallback: Save file to server/uploads
    const localPath = path.join(__dirname, '../uploads', path.basename(uniqueKey));
    // Make sure parent dirs exist (like /documents under uploads if nested)
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(localPath, fileBuffer);
    return uniqueKey; // We use the same format for local lookup
  }
};

/**
 * Generates a temporary secure presigned URL for viewing/downloading the document
 * @param {string} s3Key 
 * @param {number} expiresInSeconds - defaults to 900 (15 minutes)
 * @returns {Promise<string>} Secure temporary link
 */
const getPresignedUrl = async (s3Key, expiresInSeconds = 900) => {
  if (isS3Configured) {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    });
    // Generate secure HTTPS pre-signed URL enforcing TLS
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  } else {
    // Local Fallback: Return a local API endpoint that serves the file
    // Note: We use relative URLs, which are secure and will resolve against the request host
    return `/api/documents/local-view/${path.basename(s3Key)}`;
  }
};

/**
 * Deletes a file from S3 (or local disk in fallback mode)
 * @param {string} s3Key 
 */
const deleteFromS3 = async (s3Key) => {
  if (isS3Configured) {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    });
    await s3Client.send(command);
  } else {
    const localPath = path.join(__dirname, '../uploads', path.basename(s3Key));
    if (fs.existsSync(localPath)) {
      await fs.promises.unlink(localPath);
    }
  }
};

module.exports = {
  isS3Configured,
  uploadToS3,
  getPresignedUrl,
  deleteFromS3
};
