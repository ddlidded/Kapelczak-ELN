import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListBucketsCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { User } from '@shared/schema';

interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

export async function getS3Config(user: User): Promise<S3Config | null> {
  if (!user || !user.s3Enabled) {
    return null;
  }

  return {
    endpoint: user.s3Endpoint || '',
    region: user.s3Region || '',
    bucket: user.s3Bucket || '',
    accessKey: user.s3AccessKey || '',
    secretKey: user.s3SecretKey || ''
  };
}

export async function getS3Client(config: S3Config): Promise<S3Client> {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey
    },
    forcePathStyle: true // Required for some S3-compatible providers
  });
}

export async function testS3Connection(config: S3Config): Promise<boolean> {
  try {
    const client = await getS3Client(config);
    
    // Try to list buckets as a basic test
    const command = new ListBucketsCommand({});
    const response = await client.send(command);
    
    // Check if our bucket exists
    const bucketExists = response.Buckets?.some(bucket => bucket.Name === config.bucket);
    
    if (!bucketExists) {
      console.error(`Bucket ${config.bucket} not found`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('S3 connection test failed:', error);
    return false;
  }
}

export async function uploadFileToS3(
  config: S3Config,
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  try {
    const client = await getS3Client(config);
    const key = `files/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    // Use the Upload utility for larger files (multipart upload)
    const upload = new Upload({
      client,
      params: {
        Bucket: config.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType
      }
    });
    
    await upload.done();
    
    // Return the file path in a format that can be used by your application
    // Different S3 providers might have different URL formats
    return `${config.endpoint}/${config.bucket}/${key}`;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error('Failed to upload file to S3');
  }
}

export async function getFileFromS3(config: S3Config, filePath: string): Promise<Buffer> {
  try {
    const client = await getS3Client(config);
    
    // Extract key from filePath
    const key = filePath.split('/').slice(3).join('/'); // Skip protocol, domain, bucket
    
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key
    });
    
    const response = await client.send(command);
    
    if (!response.Body) {
      throw new Error('File not found or empty');
    }
    
    // Convert the readable stream to a buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  } catch (error) {
    console.error('Error retrieving file from S3:', error);
    throw new Error('Failed to retrieve file from S3');
  }
}

export async function deleteFileFromS3(config: S3Config, filePath: string): Promise<boolean> {
  try {
    const client = await getS3Client(config);
    
    // Extract key from filePath
    const key = filePath.split('/').slice(3).join('/'); // Skip protocol, domain, bucket
    
    const command = new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key
    });
    
    await client.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    return false;
  }
}