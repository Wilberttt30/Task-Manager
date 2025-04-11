const express = require('express')
const router = express.Router()
const path = require('path')

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'index.html'))
})

router.get('/add', (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'add.html'))
})

router.get('/edit', (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'edit.html'))
})

router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'login.html'))
})

router.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'register.html'))
})

module.exports = router