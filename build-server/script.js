const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");

const s3Client = new S3Client({
    region: "ap-south-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const PROJECT_ID = process.env.PROJECT_ID;

async function init() {
    console.log("Starting script...")
    const outDirPath = path.join(__dirname, "repo_output");

    const p = exec(`cd ${outDirPath} && npm install && npm run build`);

    p.stdout.on("data", function(data){
        console.log(data.toString());
    });

    p.stderr.on("data", function(data){
        console.error('Error:', data.toString());
    });

    p.on("close", async function (){
        console.log("Build completed");
        const distDirPath = path.join(outDirPath, "dist");
        const distFiles = fs.readdirSync(distDirPath, { recursive: true });

        for (const file of distFiles) {
            const filePath = path.join(distDirPath, file);

            if (fs.lstatSync(filePath).isDirectory()) {
                continue;
            }
            console.log('uploading', filePath)

            const command = new PutObjectCommand({
                Bucket: 'public.asharaf.dev',
                Key: `__outputs/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath)
            })

            await s3Client.send(command);

            console.log('uploaded', filePath)
        }

    });
}

init();