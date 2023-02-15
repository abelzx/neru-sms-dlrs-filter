import { neru } from 'neru-alpha';
import express from 'express';
import cors from 'cors';
import cel from "connect-ensure-login"
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { passport_auth, passport } from "./auth/passportAuth.js";
import flash from "express-flash";
import session from "express-session";
import bodyParser from 'body-parser';
import hpm from 'http-proxy-middleware';


const __dirname = dirname(fileURLToPath(import.meta.url));
const views_path = __dirname + '/views/';
const ensureLoggedIn = cel.ensureLoggedIn
const { createProxyMiddleware, fixRequestBody} = hpm;

const app = express();
const port = process.env.NERU_APP_PORT || 3002;

const COMPANY_CB = {
   'key': 'honor_cb',
   'value': 'url'
}


let sess = {
    secret: 'honorusecret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}

if (app.get('env') === 'production') {
    app.set('trust proxy', 1) // trust first proxy
    sess.cookie.secure = true // serve secure cookies
}

app.use(session(sess))
app.use(flash());
app.use(bodyParser.urlencoded({ extended: true }));


app.set('view engine', 'ejs');
app.use(cors());
app.use(express.json());
passport_auth()
app.use(passport.authenticate('session'));
app.use(express.static(__dirname + '/public'));


// Setup proxy
const customRouter = async function () {   
    const companyurl = await getGlobalState(COMPANY_CB.key, COMPANY_CB.value)
    return companyurl ?? 'http://localhost:8000'; // protocol + host
};

const filter = function(pathname, req) {
    const allowedState = ['delivered', 'expired', 'failed',  'rejected', 'unknown']

    return pathname.match('^/webhooks/delivery-receipt') && (req.method === 'GET' || req.method === 'POST') && allowedState.includes(req.body.status.toLowerCase())
}

const defaultTarget = await customRouter()

const options = {
    target: defaultTarget, // target host
    changeOrigin: true, // needed for virtual hosted sites
    router: customRouter,
    pathRewrite: {
        '^/webhooks/delivery-receipt':'' //remove /service/api
    },
    onProxyReq: (proxyReq, req, res) => {
        fixRequestBody(proxyReq, req);
    }
};

const proxy = createProxyMiddleware(filter, options);
app.use('/webhooks/delivery-receipt', proxy);


app.get('/_/health', async (req, res) => {
    res.sendStatus(200);
});

app.get('/', (req, res, next) => {
    res.redirect('/config')
})

app.get('/config', ensureLoggedIn("./login"), (req, res, next) => {
    res.render(views_path + "config.ejs")
});

app.post('/config', async (req, res) => {
    try {
        const url = req.body.callbackURL;
        const dataObj = {}
        dataObj[COMPANY_CB.value] = url
        await setGlobalState(COMPANY_CB.key, dataObj)
        const companyurl = await getGlobalState(COMPANY_CB.key, COMPANY_CB.value)

        if (companyurl === url) {
            res.sendStatus(200);
        }
        else {
            res.sendStatus(501);
        }

      } catch (error) {
        res.sendStatus(501)
      }
});

app.get('/login', function (req, res, next) {
    res.render(views_path + "login.ejs", { messages: req.flash("error") })

});

app.post('/login',  passport.authenticate('local', {
    successRedirect: "./config",
    failureRedirect: './login',
    failureFlash: true
}));


app.post('/logout', function (req, res, next) {
    req.session.destroy()
    return res.redirect('/login')
});

app.post("/webhooks/delivery-receipt", (req, res) => {
//    console.log("in post /webhooks/delivery-receipt", req.body)
   res.status(204).send()
})

app.get("/webhooks/delivery-receipt", (req, res) => {
    // console.log("in get /webhooks/delivery-receipt", req.body)
    res.status(204).send()
})

async function getGlobalState(key, dataKey) {
    const instanceState = neru.getGlobalState();
    let result =  await instanceState.hget(key, dataKey);
    return result
}

async function setGlobalState(key, data) {
    const instanceState = neru.getGlobalState();
    await instanceState.hset(key, data);
}

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
});