'use strict';

const express = require('express');
const app = express();
const https = require('https');
const http = require('http');
const mustacheExpress = require('mustache-express');
const fs = require('fs');
const cookieSession = require('cookie-session');
const bodyParser = require('body-parser');
const validator = require('validator');
const cookieParser = require('cookie-parser');
const emailer = require("emailjs");
const Pager = require('./pager.js');

const HTTP_PORT = 80;
const HTTPS_PORT = 443;

function ensureSecure(req, res, next){
  if(req.secure){
    return next();
  };
  res.redirect('https://' + req.hostname + req.url);
};

app.all('*', ensureSecure);

app.locals.emailServer = emailer.server.connect({
   user:    "manager@prefx48.me",
   password:"l33tPassword",
   host:    "mail.privateemail.com",
   ssl:     true
});

app.engine('html', mustacheExpress());
app.set('view engine', 'html');
app.set('views', __dirname + '/../html');

app.use(express.static(__dirname + '/../public'));
app.use(function(req, res, next) {
    console.log("New request: " + req.method + ' ' + req.originalUrl);
    next();
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}));
app.use(cookieSession({
    name: 'session',
    secret: 'Wow such phrase so secret',
    maxAge: 1000*60*60*24*30 // 30 days
}));
app.use(cookieParser());
var pager = new Pager(app);

(function() {
    let usersList = JSON.parse(fs.readFileSync(__dirname + '/../data/users.json'));
    app.locals.usersIds = {};
    for (let i = 0; i < usersList.length; ++i) {
        app.locals.usersIds[usersList[i].Nominativ] = i;
    }
})();

var config = {
    key: fs.readFileSync('/etc/letsencrypt/live/prefx48.me/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/prefx48.me/cert.pem'),
    ca: fs.readFileSync('/etc/letsencrypt/live/prefx48.me/chain.pem')
};

http.createServer(app).listen(HTTP_PORT)
https.createServer(config, app).listen(HTTPS_PORT)
