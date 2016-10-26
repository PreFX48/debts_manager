'use strict';

const express = require('express');
const app = express();
const mustacheExpress = require('mustache-express');
const fs = require('fs');
const cookieSession = require('cookie-session');
const bodyParser = require('body-parser');

const PORT = process.env.PORT || 4000;

function zip(...collections) {
    let result = [];
    let min_length = Math.min(...(collections.map((collection) => {return collection.length;})));
    for (let i = 0; i < min_length; ++i) {
        let element = [];
        for (let j = 0; j < collections.length; ++j) {
            element.push(collections[j][i]);
        }
        result.push(element);
    }
    return result;
}

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
    if (logins[req.body.login] === req.body.password) {
        req.session.authorized = true;
        req.session.user = req.body.login;
        res.redirect('/');
    } else {
        req.session = null;
        res.status(403).send();
    }
}

function respondMainPage(req, res, next) {
    if (!req.session || !req.session.authorized) {
        res.redirect('/login');
        return;
    }
    let debts = JSON.parse(fs.readFileSync(__dirname + '/debts.json'));
    let requests = JSON.parse(fs.readFileSync(__dirname + '/requests.json'));
    let users = JSON.parse(fs.readFileSync(__dirname + '/users.json'));
    res.status(200);
    res.render('index', {
        'debts': debts,
        'requests': requests,
        'users': users
    });
}

function postRequest(req, res, next) {
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
    fs.writeFileSync(__dirname + '/requests.json', JSON.stringify(requests));
    res.redirect('/');
}


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
    secret: 'Wow such phrase so secret'
}));
app.get('/', respondMainPage);
app.get('/login', respondLoginPage);
app.post('/login', postLogin);
app.post('/make_request', postRequest);

app.listen(PORT, function () {
    console.log(`App is listening on ${PORT}`);
});
