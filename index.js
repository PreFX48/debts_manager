'use strict';

const express = require('express');
const app = express();
const mustacheExpress = require('mustache-express');
const fs = require('fs');
const cookieSession = require('cookie-session');
const bodyParser = require('body-parser');
const validator = require('validator');
const cookieParser = require('cookie-parser');

const PORT = process.env.PORT || 80;

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
function respondSettingsPage(req, res, next) {
    if (!req.session || !req.session.authorized) {
        res.redirect('/login');
        return;
    }
    res.status(200).render('settings');
}

function updateSettings(req, res, next) {
    if (req.session.user) {
        let logins = JSON.parse(fs.readFileSync(__dirname + '/logins.json'));
        logins[req.session.user] = req.body.newPassword;
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
    for (var request of requests) {
        if (request.to === req.session.user && !request.accepted) {
            request.canHandle = true;
        }
    }
    res.status(200);

    if (req.cookies.mobile && req.cookies.mobile === 'true') {
        debts = debts.map(user => {return { 'name': user.name,
                                            'debt': user.debts[req.app.locals.usersIds[req.session.user]]
                                          };
                                  });
        debts.splice(req.app.locals.usersIds[req.session.user], 1);
        res.render('mobile', {
            'debts': debts,
            'requests': requests
        });
    } else {
        res.render('index', {
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
    fs.writeFileSync(__dirname + '/requests.json', JSON.stringify(requests));
    res.redirect('/');
}

function handleRequest(req, res, next) {
    let requests = JSON.parse(fs.readFileSync(__dirname + '/requests.json'));
    let ok, id;
    if (req.body.request_ok !== undefined) {
        ok = true;
        id = parseInt(req.body.request_ok);
    } else {
        ok = false;
        id = parseInt(req.body.request_reject);
    }
    for (var i = 0; i < requests.length; ++i) {
        if (id === requests[i].id) {
            if (requests[i].to === req.session.user) {
                if (ok) {
                    let ids = req.app.locals.usersIds;
                    let debts = JSON.parse(fs.readFileSync(__dirname + '/debts.json'));
                    debts[ids[requests[i].from]].debts[ids[requests[i].to]] -= parseInt(requests[i].transfer);
                    debts[ids[requests[i].to]].debts[ids[requests[i].from]] += parseInt(requests[i].transfer);
                    fs.writeFileSync(__dirname + '/debts.json',
                                     JSON.stringify(debts));
                    requests[i].accepted = true;
                    delete requests[i].canHandle;
                } else {
                    requests.splice(i, 1);
                }
                fs.writeFileSync(__dirname + '/requests.json',
                                 JSON.stringify(requests));
                res.redirect('/');
            } else {
                res.status(403).send();
            }
            return;
        }
    }
    res.status(403).send();
}

function logout(req, res, next) {
    req.session = null;
    res.redirect('/login');
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
app.post('/handle_request', handleRequest);
app.post('/update_settings', updateSettings);

(function() {
    let usersList = JSON.parse(fs.readFileSync(__dirname + '/users.json'));
    app.locals.usersIds = {};
    for (let i = 0; i < usersList.length; ++i) {
        app.locals.usersIds[usersList[i].Nominativ] = i;
    }
})();

app.listen(PORT, function () {
    console.log(`App is listening on ${PORT}`);
});
