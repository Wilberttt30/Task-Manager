const fs = require('fs')
const { PrismaClient } = require('@prisma/client')
const express = require('express')
const cors = require('cors')
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser')
const jwt = require("jsonwebtoken");
const dotenv = require('dotenv')

dotenv.config()

const prisma = new PrismaClient()
const app = express()
const port = 3000

// Middlewares
app.use(cors())
app.use(express.static('public'))
app.use(express.json())
app.use(logging)
app.use(bodyParser.urlencoded({extended:true}))
app.use(bodyParser.json())
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
    if (isNaN(req.query.page) || req.query.page == "" || isNaN(req.query.limit) || req.query.limit == "") {
        req.query.page = 1
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
    if (typeof req.body === 'object' && !Array.isArray(req.body)) {
        const { task } = req.body
        if( !task ) return res.json({status: 406, error: 'Field must be filled!'})
        if ( task.length > 10 ) return res.json({status: 406, error: 'Field must not exceed 10 characters'})
        return next()
    } else {
        res.json({error: 'Invalid JSON'})
    } 
}

async function auth(req, res, next) {
    const cookie = req.cookies.cookie
    try {
        const decoded = jwt.verify(cookie, process.env.ACCESS_TOKEN_SECRET)
        req.user = decoded
        next()
        // const user = await prisma.user.findUnique({
        //     where: {
        //         id: decoded.id
        //     }
        // })
    } catch (error) {
        res.clearCookie('cookie')
        res.redirect('/')
    }
}

function authorization(req, res, next) {
    console.log(req.user)
    next()
}

app.post('/register', async (req, res) => {
    const { username, password } = req.body
    if (username == "" || password == "") return res.status(400).json({err: 'Field must be filled!'})
    
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

    res.status(201).json({msg: 'Registration Sucessful', account: register})
})

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (username == "" || password == "") return res.status(400).json({err: 'Field must be filled!'})

    const loginUser = await prisma.user.findFirst({
        where: {
            username: username
        }
    })
    if (loginUser == null) return res.status(404).json({err: "Account Not Found!"})
    
    // If wrong password
    const loginUserPassword = loginUser.password
    if (password != loginUserPassword) return res.status(401).json({err: 'Wrong password'})

    // Generate token
    const token = jwt.sign(loginUser, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})

    res.cookie('cookie', token, { httpOnly: true })

    res.status(302).json({msg: 'Login Success'})
})

// app.get('/auth', async (req, res) => {
//     try {
//         const cookie = req.cookies.cookie
//         const decoded = jwt.verify(cookie, process.env.ACCESS_TOKEN_SECRET)
//         const user = await prisma.user.findUnique({
//             where: {
//                 id: decoded.id
//             }
//         })
//         console.log(user)
//         res.status(200).json({message: 'Authenthication Sucess'})
//     } catch (error) {
//         res.clearCookie('cookie')
//         return res.redirect('./')
//     }
// })

// app.get('/protected2', (req, res) => {
//     try {
//         const headersToken = req.headers.authorization
//         const token = headersToken.split(" ")[1]
//         jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

//         res.status(202).json({message: 'User Autharize'})

//     } catch (error) {
//         res.json({message: 'Invalid Autharization'})
//     }
// })

app.get('/api', queryParams, auth, authorization, async (req, res) => {
    console.log(req.user)
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
        ]
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

app.post('/api', async (req, res) => {
    const { task } = req.body

    const createTask = await prisma.task.create({
        data: {
            taskName: task,
            status: false
        }
    }) 

    res.status(200).json({msg: 'Task Created', createdTask: createTask})
})

app.get('/api/:id', idValidation, async (req, res) => {
    const id = req.params.id
    const getTaskID = await prisma.task.findUnique({
        where: { id: id }
    })
    if (!getTaskID) return res.status(404).send({error: 'ID Not Found'})

    res.status(200).send({msg: 'ID Found', task: getTaskID})
})

app.put('/api/:id', idValidation, formValidation, async (req, res) => {
    const id = req.params.id
    const getTaskID = await prisma.task.findUnique({
        where: { id: id }
    })
    if (!getTaskID) return res.status(404).send({error: 'ID Not Found'})

    const { task } = req.body
    const updateTask = await prisma.task.update({ where: { id: id }, data: { taskName: task }})

    res.status(200).send({msg: 'ID Updated', task: updateTask})
})

// True false checklist
app.patch('/api/:id', idValidation, async (req, res) => {
    const id = req.params.id
    const { statusTask } = req.body
    const updateStatusTask = await prisma.task.update({
        where: { id: id },
        data: { status: statusTask },
      })

      res.status(200).send({msg: 'Status Updated', statusUpdate: updateStatusTask})
})

app.delete('/api/:id', idValidation, async (req, res) => {
    const id = req.params.id

    if (isNaN(id)) return res.status(400).send({error: 'ID must be number'})
        
    const getTaskID = await prisma.task.findUnique({
        where: { id: id }
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