const express = require('express');
const app = express();
const PORT = 9000;
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
const dotenv = require('dotenv');
dotenv.config();
console.log("AWS_ACCESS_KEY_ID", process.env.AWS_ACCESS_KEY_ID);
const ecsClient = new ECSClient({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})
app.use(express.json());
const config = {
    CLUSTER: process.env.AWS_CLUSTER_ARN,
    TASK: process.env.AWS_TASK_ARN
}
app.post('/project', async (req, res) => {
    const { gitURL } = req.body;
    const projectSlug = generateSlug();
    //spin up a new container with the gitURL and projectSlug
    const commmand = new RunTaskCommand({
        cluster: config.CLUSTER,
        taskDefinition: config.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: ['subnet-0e568cc0972510ddf', 'subnet-09671d32294e16866', 'subnet-053d46d3dccfda809'],
                securityGroups: ['sg-0b7370604e66cb39c']
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'image-builder',
                    environment: [
                        {
                            name: 'GIT_REPO_URL',
                            value: gitURL
                        },
                        {
                            name: 'PROJECT_ID',
                            value: projectSlug
                        },
                        {
                            name: 'AWS_ACCESS_KEY_ID',
                            value: process.env.AWS_ACCESS_KEY_ID
                        },
                        {
                            name: 'AWS_SECRET_ACCESS_KEY',
                            value: process.env.AWS_SECRET_ACCESS_KEY
                        }
                    ]
                }
            ]
        }
    })

    await ecsClient.send(commmand);

    return res.json({
        status: 'queued',
        data: {
            projectSlug,
            url: `http://${projectSlug}.localhost:8000`
        }
    })
})


app.listen(PORT, () => console.log(`API server is running on ${PORT}`))