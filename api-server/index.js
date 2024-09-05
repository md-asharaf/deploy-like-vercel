const express = require('express');
const { Server } = require('socket.io')
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
// const Redis = require('ioredis');
const cors = require('cors')
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client')
const { createClient } = require('@clickhouse/client')
const dotenv = require('dotenv');
const { error } = require('console');

dotenv.config();

console.log("ENV:", process.env)

// const subscriber = new Redis('redis://default:fPGg5EFmFVTuLWxemeOO8jKwiwQVsRyj@redis-19058.c305.ap-south-1-1.ec2.redns.redis-cloud.com:19058')

const prisma = new PrismaClient();

const ecsClient = new ECSClient({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})

const config = {
    CLUSTER: process.env.AWS_CLUSTER_ARN,
    TASK: process.env.AWS_TASK_ARN
}

const initRedisSubscribe = async () => {
    console.log('Subscribed to logs...')
    subscriber.psubscribe('logs:*');
    subscriber.on('pmessage', (_, channel, message) => {
        io.to(channel).emit('message', message);
    })
}

const io = new Server({
    cors: "*"
})

io.on('connection', (socket) => {
    socket.on('subscribe', (room) => {
        socket.join(room);
        socket.emit('message', `Joined ${room}`);
    })
})

io.listen(9001, () => console.log('Socket server is running on 9001'))

const PORT = 9000;

const app = express();
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;
const PROJECT_ID = process.env.PROJECT_ID;
app.use(express.json());
app.use(cors());

app.post('/project', async (req, res) => {
    const schema = z.object({
        name: z.string(),
        gitURL: z.string()
    })

    const safeParsedBody = schema.safeParse(req.body);
    if (!safeParsedBody.success) {
        return res.status(400).json({
            error: safeParsedBody.error.errors
        })
    }
    const { name, gitURL } = safeParsedBody.data;
    const project = await prisma.project.create({
        data: {
            name, gitURL, subDomain: generateSlug()
        }
    })

    return res.json({
        success: true,
        data: { project }
    })
})

app.post('/deploy', async (req, res) => {
    const { projectId } = req.body;
    const project = await prisma.project.findUnique({
        where: {
            id: projectId
        }
    })

    if (!project) {
        return res.status(404).json({
            error: 'Project not found'
        })
    }
    const deployment = await prisma.deployment.create({
        data: {
            project: {
                connect: {
                    id: projectId
                }
            },
            status: 'QUEUED'
        }
    })
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
                            value: project.gitURL
                        },
                        {
                            name: 'PROJECT_ID',
                            value: projectId
                        },
                        {
                            name: 'DEPLOYMENT_ID',
                            value: deployment.id
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
            projectId,
            url: `http://${projectId}.localhost:8000`
        }
    })
})

initRedisSubscribe();

app.listen(PORT, () => console.log(`API server is running on ${PORT}`))