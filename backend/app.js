const fs = require('fs')
const express = require('express')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const app = express()
const port = 3000

app.use(express.static('public'))
app.use(logging)

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

app.get('/api', queryParams, async (req, res) => {
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
    res.status(200).send({ msg: 'Successfully Fetch Data', task: result })
})

app.post('/api', formValidation, async (req, res) => {
    const { task } = req.body

    const createTask = await prisma.task.create({
        data: {
            taskName: task,
            status: false
        }
    }) 

    res.status(200).send({msg: 'Task Created', createdTask: createTask})
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