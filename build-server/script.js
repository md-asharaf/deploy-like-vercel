const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const {Kafka} = require('kafkajs');
// const Redis = require("ioredis");
const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const kafka= new Kafka({
  clientId: `docker-build-server-${PROJECT_ID}`,
  brokers:[],
  ssl: {
    ca:[fs.readFileSync(path.join(__dirname,'kafka.pem'),'utf-8')],
  },
  sasl: {
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
    mechanism: 'plain'
  },
})
const producer= kafka.producer();
// const publisher = new Redis('redis://default:fPGg5EFmFVTuLWxemeOO8jKwiwQVsRyj@redis-19058.c305.ap-south-1-1.ec2.redns.redis-cloud.com:19058')

const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;  
const PROJECT_ID = process.env.PROJECT_ID;

const publishLog = async (log) => {
  // publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
  await producer.send({
    topic:'container-logs',
    messages:[
      {
        key:'log',
        value:JSON.stringify({PROJECT_ID,DEPLOYMENT_ID,log})
      }
    ]
  })
};
async function init() {
  await producer.connect();
  await publishLog("Starting script...");
  const outDirPath = path.join(__dirname, "repo_output");
  const p = exec(`cd ${outDirPath} && npm install && npm run build`);
  p.stdout.on("data", async function (data) {
    await publishLog(data.toString());
  });

  p.stderr.on("data", async function (data) {
    await publishLog(`Error: ${data.toString()}`);
  });

  p.on("close", async function () {
    await publishLog("Build completed");
    const distDirPath = path.join(outDirPath, "dist");
    const distFiles = fs.readdirSync(distDirPath, { recursive: true });

    for (const file of distFiles) {
      const filePath = path.join(distDirPath, file);

      if (fs.lstatSync(filePath).isDirectory()) {
        continue;
      }
      await publishLog(`Uploading ${file}...`);

      const command = new PutObjectCommand({
        Bucket: "public.asharaf.dev",
        Key: `__outputs/${PROJECT_ID}/${file}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath),
      });

      await s3Client.send(command);

      await publishLog(`uploaded ${file}`);
    }
    process.exit(0);
  });
} 

init();
