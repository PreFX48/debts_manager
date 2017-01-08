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

const HTTP_PORT = 80;
const HTTPS_PORT = 443;

function respondLoginPage(req, res, next) {
    if (req.session && req.session.authorized) {
        res.redirect('/');
    } else {
        req.session = null;
        res.status(200).render('login');
    }
}
function postLogin(req, res, next) {
    let logins = JSON.parse(fs.readFileSync(__dirname + '/logins.json'));
    if (logins[req.body.login].password === req.body.password) {
        req.session.authorized = true;
        req.session.user = req.body.login;
        res.redirect('/');
    } else {
        req.session = null;
        res.status(403).send();
    }
}
function respondSettingsPage(req, res, next) {
    if (!req.session || !req.session.authorized) {
        res.redirect('/login');
        return;
    }
    res.status(200).render('settings');
}

function updatePassword(req, res, next) {
    if (req.session.user) {
        let logins = JSON.parse(fs.readFileSync(__dirname + '/logins.json'));
        logins[req.session.user].password = req.body.newPassword;
        fs.writeFileSync(__dirname + '/logins.json', JSON.stringify(logins));
        res.redirect('/');
    }
}
function updateEmail(req, res, next) {
    if (req.session.user) {
        let logins = JSON.parse(fs.readFileSync(__dirname + '/logins.json'));
        logins[req.session.user].email = req.body.newEmail;
        fs.writeFileSync(__dirname + '/logins.json', JSON.stringify(logins));
        res.redirect('/');
    }
}

function respondMainPage(req, res, next) {
    if (!req.session || !req.session.authorized) {
        res.redirect('/login');
        return;
    }
    if (req.query.mobile === 'true') {
        res.cookie('mobile', 'true');
        res.redirect('/');
    } else if (req.query.mobile === 'false') {
        res.cookie('mobile', 'false');
        res.redirect('/');
    }

    let debts = JSON.parse(fs.readFileSync(__dirname + '/debts.json'));
    let users = JSON.parse(fs.readFileSync(__dirname + '/users.json'));
    let requests = JSON.parse(fs.readFileSync(__dirname + '/requests.json'));
    let logins = JSON.parse(fs.readFileSync(__dirname + '/logins.json'));
    res.status(200);

    let warnAboutEmail = !logins[req.session.user].email;

    if (req.cookies.mobile && req.cookies.mobile === 'true') {
        debts = debts.map(user => {return { 'name': user.name,
                                            'debt': user.debts[req.app.locals.usersIds[req.session.user]]
                                          };
                                  });
        debts.splice(req.app.locals.usersIds[req.session.user], 1);
        res.render('mobile', {
            'warnAboutEmail': warnAboutEmail,
            'debts': debts,
            'requests': requests
        });
    } else {
        res.render('index', {
            'warnAboutEmail': warnAboutEmail,
            'debts': debts,
            'requests': requests,
            'users': users
        });
    }
}

function postRequest(req, res, next) {
    if (!validator.isInt(''+req.body.money, {min: 1})) {
        res.status(400).send();
        return;
    }
    let requests = JSON.parse(fs.readFileSync(__dirname + '/requests.json'));
    let newElement = {id: 0,
                      from: req.session.user,
                      to: req.body.to,
                      transfer: req.body.money};
    if (requests.length === 0) {
        requests.push(newElement);
    } else {
        newElement.id = requests[0].id + 1;
        requests.unshift(newElement);
    }
    let logins = JSON.parse(fs.readFileSync(__dirname + '/logins.json'));
    if (logins[newElement.to].email) {
      let address = logins[newElement.to].email;
      var message = {
         from:    "PreFX48 <manager@prefx48.me>",
         to:      newElement.to + " <" + address + ">",
         subject: "Денежки",
         attachment:
         [
            {data:"<html><p>Пользователь <strong>" + newElement.from + "</strong> указал, что вы должны ему дополнительно <strong>" + newElement.transfer + "</strong>р</p>\
                   <p>Перейти на сайт: <a href='http://prefx48.me'>prefx48.me</a></p></html>", alternative:true},
         ]
      };
      app.locals.emailServer.send(message, function(err, message) {
        if (err) {console.log(err);
        }
      });
    }
    // TODO: log all sent emails

    let ids = req.app.locals.usersIds;
    let debts = JSON.parse(fs.readFileSync(__dirname + '/debts.json'));
    debts[ids[newElement.from]].debts[ids[newElement.to]] -= parseInt(newElement.transfer);
    debts[ids[newElement.to]].debts[ids[newElement.from]] += parseInt(newElement.transfer);
    fs.writeFileSync(__dirname + '/debts.json',
                     JSON.stringify(debts));

    fs.writeFileSync(__dirname + '/requests.json', JSON.stringify(requests));
    res.redirect('/');
}

function logout(req, res, next) {
    req.session = null;
    res.redirect('/login');
}


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
app.set('views', __dirname + '/html');

app.use(express.static(__dirname + '/public'));
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

app.get('/', respondMainPage);
app.get('/login', respondLoginPage);
app.get('/settings', respondSettingsPage);
app.get('/logout', logout);
app.post('/login', postLogin);
app.post('/make_request', postRequest);
app.post('/update_password', updatePassword);
app.post('/update_email', updateEmail);

(function() {
    let usersList = JSON.parse(fs.readFileSync(__dirname + '/users.json'));
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
