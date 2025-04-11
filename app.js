const fs = require('fs')
const { PrismaClient } = require('@prisma/client')
const express = require('express')
const cookieParser = require('cookie-parser')
const jwt = require("jsonwebtoken");
const dotenv = require('dotenv')

dotenv.config()

const prisma = new PrismaClient()
const app = express()
const port = 3000

// Middlewares
app.use(express.static('public'))
app.use(express.json())
app.use(logging)
app.use(cookieParser())

function logging(req, res, next) {
    const date = new Date()
    const formatDate = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} ${date.toDateString()}`

    const log = `${req.method} "${req.url}" at ${formatDate}\n`

    fs.appendFile('log.txt', log, err => {
        if (err) {
            console.error(err)
        }
    })
    next()
}

function queryParams(req, res, next) {
    if (isNaN(req.query.page) || req.query.page == "") {
        req.query.page = 1
    } 
    if (isNaN(req.query.limit) || req.query.limit == "") {
        req.query.limit = 5
    }
    next()
}

function idValidation(req, res, next) {
    if (isNaN(req.params.id)) {
        res.json({error: 'ID must be number'})
    } else {
        req.params.id = parseInt(req.params.id)
        return next()
    }
}

function formValidation(req, res, next) {
    const { task } = req.body

    if (task == undefined) {
        return res.status(406).json({err: 'task required'})
    } else if (typeof task !== 'string') {
        return res.status(406).json({err: 'task type must be string'})
    } else if (task.length == 0) {
        return res.status(406).json({err: 'Task field must be filled!'})
    } else if (task.length > 10) {
        return res.status(406).json({err: 'Field must not exceed 10 characters long'})
    } else {
        return next()
    }
}

async function auth(req, res, next) {
    const cookie = req.cookies.cookie
    try {
        const decoded = jwt.verify(cookie, process.env.ACCESS_TOKEN_SECRET)
        const user = await prisma.user.findFirst({
            where: {
                id: decoded.id
            }
        })
        req.user = user
        if (!req.user) return res.status(403).json({err: 'Forbidden'})
        next()
    } catch (error) {
        res.clearCookie('cookie')
        res.status(401).json({msg: 'You are not authenticated!'})
    }
}

function userInfoNotEmpty(req, res, next) {
    const { username, password } = req.body
    // Username and password validation
    if (username == undefined || password == undefined) {
        return res.status(406).json({err: 'Username or password required!'})
    } else if (typeof username !== 'string' || typeof password !== 'string') { 
        return res.status(406).json({err: 'Username or password type must be string!'})
    } else if (username == "" || password == "") {
        return res.status(406).json({err: 'Username or password field must be filled!'})
    } else {
        return next()
    }
}

function statusTaskValidation(req, res, next) {
    const statusTask = req.body.statusTask
    if (statusTask === undefined) {
        return res.status(406).json({err: 'statusTask required!'})
    } else if (typeof statusTask !== 'boolean') {
        return res.status(406).json({err: 'Type is not boolean'})
    } else {
        return next()
    }
}

const taskRouter = require('./routes/task');
const { type } = require('os');
app.use('/', taskRouter)

app.post('/register', userInfoNotEmpty, async (req, res) => {
    const { username, password } = req.body
    
    const findUser = await prisma.user.findFirst({
        where: {
            username: username
        }
    })

    if (findUser) return res.status(409).json({err: 'Username already existed!'})

    const register = await prisma.user.create({
        data: {
            username: username,
            password: password
        }
    })

    res.status(201).json({msg: 'Registration Sucessful'})
})

app.post('/login', userInfoNotEmpty, async (req, res) => {
    const { username, password } = req.body;

    const loginUser = await prisma.user.findFirst({
        where: {
            username: username
        }
    })
    if (loginUser == null) return res.status(404).json({err: "Account Not Found!"})
    
    // If wrong password
    const loginUserPassword = loginUser.password
    if (password != loginUserPassword) return res.status(401).json({err: 'Wrong password'})
    // ID
    const loginId = loginUser.id
    // Generate token
    const token = jwt.sign({id: loginId}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})

    res.cookie('cookie', token, { httpOnly: true })

    res.status(302).json({msg: 'Login Success'})
})

app.get('/api', queryParams, auth, async (req, res) => {
    const id = req.user.id
    const page = parseInt(req.query.page)
    const limit = parseInt(req.query.limit)

    const startIndex = (page - 1) * limit;
    const lastIndex = page * limit

    const result = {}
    
    const allTask = await prisma.task.findMany({
        skip: ( page - 1 ) * limit,
        take: limit,
        orderBy: [
            { id: 'desc' }
        ],
        where: {
            userId: id
        }
    })

    // Previous
    if (startIndex > 0) {
        result.previous = {
            page: page - 1,
            limit: limit
        }
    }
    // Next
    const totalTask = await prisma.task.count()
    if (lastIndex < totalTask) {
        result.next = {
            page: page + 1,
            limit: limit
        }
    }
    
    result.results = allTask
    res.status(200).json({ msg: 'Successfully Fetch Data', task: result })
})

app.get('/api/user', auth, (req, res) => {
    const user = req.user.username
    res.status(200).json({user: user})
})

app.post('/api', auth, formValidation, async (req, res) => {
    const { task } = req.body
    const id = req.user.id

    let createTask = await prisma.task.create({
        data: {
            taskName: task,
            status: false,
            userId: id
        }
    }) 

    res.status(200).json({msg: 'Task Created', createdTask: createTask})
})

app.get('/api/:id', auth, idValidation, async (req, res) => {
    const id = req.params.id
    const getTaskID = await prisma.task.findUnique({
        where: { id: id, userId: req.user.id }
    })
    if (!getTaskID) return res.status(404).send({error: 'ID Not Found'})

    res.status(200).send({msg: 'ID Found', task: getTaskID })
})

app.put('/api/:id', auth, idValidation, formValidation, async (req, res) => {
    const id = req.params.id
    const getTaskID = await prisma.task.findUnique({
        where: { id: id, userId: req.user.id }
    })
    if (!getTaskID) return res.status(404).send({error: 'ID Not Found'})

    const { task } = req.body
    const updateTask = await prisma.task.update({ where: { id: id }, data: { taskName: task }})

    res.status(200).send({msg: 'ID Updated', task: updateTask})
})

// True false checklist
app.patch('/api/:id', auth, idValidation, statusTaskValidation, async (req, res) => {
    const id = req.params.id
    const { statusTask } = req.body
    const updateStatusTask = await prisma.task.update({
        where: { id: id, userId: req.user.id },
        data: { status: statusTask },
      })

    res.status(200).send({msg: 'Status Updated', statusUpdate: updateStatusTask})
})

app.delete('/api/:id', auth, idValidation, async (req, res) => {
    const id = req.params.id
        
    const getTaskID = await prisma.task.findUnique({
        where: { id: id, userId: req.user.id }
    })

    if (!getTaskID) return res.status(404).send({error: 'ID Not Found'})
    const deleteTask = await prisma.task.delete({
        where: {
            id: id,
        },
    })

    res.status(200).send({msg: 'ID Deleted', task: deleteTask})
})

app.listen(port, () => {
    console.log(`Listening to port ${port}`)
})