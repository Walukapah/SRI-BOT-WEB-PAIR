const express = require('express');
const app = express();
__path = process.cwd()
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;
let code = require('./pair');
require('events').EventEmitter.defaultMaxListeners = 500;

// Middleware order correction
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/code', code);

app.get('/', async (req, res, next) => {
    res.sendFile(__path + '/pair.html')
})

app.listen(PORT, () => {
    console.log(`⏩ Server running on http://localhost:` + PORT)
})

module.exports = app
